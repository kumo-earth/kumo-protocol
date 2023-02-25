import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Decimal,
    Decimalish,
    KumoReceipt,
    SuccessfulReceipt,
    SentKumoTransaction,
    KUSD_LIQUIDATION_RESERVE,
    MINIMUM_BORROWING_RATE
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";


const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


// Extra ETH sent to users to be spent on gas
const GAS_BUDGET = Decimal.from(0.1); // ETH

const STARTING_BALANCE = Decimal.from(100);


const connectToDeployment = async (
    deployment: _KumoDeploymentJSON,
    signer: Signer,
    frontendTag?: string
) =>
    EthersKumo._from(
        _connectToDeployment(deployment, signer, {
            userAddress: await signer.getAddress(),
            frontendTag
        })
    );

const increaseTime = async (timeJumpSeconds: number) => {
    await provider.send("evm_increaseTime", [timeJumpSeconds]);
};

function assertStrictEqual<T, U extends T>(
    actual: T,
    expected: U,
    message?: string
): asserts actual is U {
    assert.strictEqual(actual, expected, message);
}


const waitForSuccess = async <T extends KumoReceipt>(
    tx: Promise<SentKumoTransaction<unknown, T>>
) => {
    const receipt = await (await tx).waitForReceipt();
    assertStrictEqual(receipt.status, "succeeded" as const);

    return receipt as Extract<T, SuccessfulReceipt>;
};

const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const


describe("EthersKumoGasChecks", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let deployerKumo: EthersKumo;
    let kumo: EthersKumo;
    let otherKumos: EthersKumo[];


    let mockAssetAddress: string;
    
    const gasLimit = BigNumber.from(2500000);



    const connectUsers = (users: Signer[]) =>
        Promise.all(users.map(user => connectToDeployment(deployment, user)));


    const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
        funder.sendTransaction({
            to: user.getAddress(),
            value: Decimal.from(value).add(GAS_BUDGET).hex,
            nonce
        });

    const sendToEach = async (users: Signer[], value: Decimalish) => {
        const txCount = await provider.getTransactionCount(funder.getAddress());
        const txs = await Promise.all(users.map((user, i) => sendTo(user, value, txCount + i)));

        // Wait for the last tx to be mined.
        await txs[txs.length - 1].wait();
    };


    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Redemption gas checks ${mockAssetContract.name}`, function () {
            this.timeout("5m");

            const massivePrice = Decimal.from(1000000);

            const amountToBorrowPerTrove = Decimal.from(2000);
            const netDebtPerTrove = MINIMUM_BORROWING_RATE.add(1).mul(amountToBorrowPerTrove);
            const collateralPerTrove = netDebtPerTrove
                .add(KUSD_LIQUIDATION_RESERVE)
                .mulDiv(1.5, massivePrice);

            const amountToRedeem = netDebtPerTrove.mul(_redeemMaxIterations);
            const amountToDeposit = MINIMUM_BORROWING_RATE.add(1)
                .mul(amountToRedeem)
                .add(KUSD_LIQUIDATION_RESERVE)
                .mulDiv(2, massivePrice);
            before(async function () {
                if (network.name !== "hardhat") {
                    // Redemptions are only allowed after a bootstrap phase of 2 weeks.
                    // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
                    this.skip();
                }

                // Deploy new instances of the contracts, for a clean state
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const otherUsersSubset = otherUsers.slice(0, _redeemMaxIterations);
                expect(otherUsersSubset).to.have.length(_redeemMaxIterations);

                [deployerKumo, kumo, ...otherKumos] = await connectUsers([
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);

                await deployerKumo.setPrice(mockAssetAddress, massivePrice);
                await sendToEach(otherUsersSubset, 0.1);

                for (const otherKumo of otherKumos) {
                    await otherKumo.openTrove(
                        {
                            depositCollateral: collateralPerTrove,
                            borrowKUSD: amountToBorrowPerTrove
                        },
                        mockAssetAddress,

                        undefined,
                        { gasLimit }
                    );
                }

                await increaseTime(60 * 60 * 24 * 15);
            });
             // Always setup same initial balance for user
             beforeEach(async () => {
                const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

                const gasPrice = BigNumber.from(100e9); // 100 Gwei

                const balance = await user.getBalance();
                const txCost = gasLimit.mul(gasPrice);

                if (balance.eq(targetBalance)) {
                    return;
                }

                if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
                    await funder.sendTransaction({
                        to: user.getAddress(),
                        value: targetBalance.add(txCost).sub(balance).add(1),
                        gasLimit,
                        gasPrice
                    });

                    await user.sendTransaction({
                        to: funder.getAddress(),
                        value: 1,
                        gasLimit,
                        gasPrice
                    });
                } else {
                    if (balance.lt(targetBalance)) {
                        await funder.sendTransaction({
                            to: user.getAddress(),
                            value: targetBalance.sub(balance),
                            gasLimit,
                            gasPrice
                        });
                    } else {
                        await user.sendTransaction({
                            to: funder.getAddress(),
                            value: balance.sub(targetBalance).sub(txCost),
                            gasLimit,
                            gasPrice
                        });
                    }
                }
                expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
            });
            it(`should redeem using the maximum iterations and almost all gas ${mockAssetContract.name}`, async () => {
                await kumo.openTrove(
                    {
                        depositCollateral: amountToDeposit,
                        borrowKUSD: amountToRedeem
                    },
                    mockAssetAddress,

                    undefined,
                    { gasLimit }
                );

                const { rawReceipt } = await waitForSuccess(kumo.send.redeemKUSD(mockAssetAddress, amountToRedeem));

                const gasUsed = rawReceipt.gasUsed.toNumber();
                // gasUsed is ~half the real used amount because of how refunds work, see:
                // https://ethereum.stackexchange.com/a/859/9205
                expect(gasUsed).to.be.at.least(4900000, "should use close to 10M gas");
            });

        });
    })
});