import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Decimal,
    Decimalish,
    Trove,
    KumoReceipt,
    SuccessfulReceipt,
    SentKumoTransaction,
    KUSD_MINIMUM_NET_DEBT
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";


const ERC20ABI = require("../abi/ERC20Test.json")

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


// Extra ETH sent to users to be spent on gas
const GAS_BUDGET = Decimal.from(0.1); // ETH

const STARTING_BALANCE = Decimal.from(1000);


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


describe("EthersKumoRedemptionTruncation", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let deployerKumo: EthersKumo;
    let kumo: EthersKumo;
    let otherKumos: EthersKumo[];


    let mockAssetAddress: string;
    let mockAsset: any;

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

    before(async function () {
        if (network.name !== "hardhat") {
            // Redemptions are only allowed after a bootstrap phase of 2 weeks.
            // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
            this.skip();
        }
        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
        deployment = await deployKumo(deployer);
        kumo = await connectToDeployment(deployment, user);
        expect(kumo).to.be.an.instanceOf(EthersKumo);
    });


    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Redemption truncation ${mockAssetContract.name}`, () => {
            const troveCreationParams = { depositCollateral: 20, borrowKUSD: 2000 };
            const netDebtPerTrove = Trove.create(troveCreationParams).netDebt;
            const amountToAttempt = Decimal.from(3000);
            const expectedRedeemable = netDebtPerTrove.mul(2).sub(KUSD_MINIMUM_NET_DEBT);
            beforeEach(async () => {
                // Deploy new instances of the contracts, for a clean state
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                mockAsset = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
                const otherUsersSubset = otherUsers.slice(0, 3);
                [deployerKumo, kumo, ...otherKumos] = await connectUsers([
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);
                await sendToEach(otherUsersSubset, 0.1);

                await kumo.openTrove(
                    { depositCollateral: 99, borrowKUSD: 5000 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                await otherKumos[0].openTrove(troveCreationParams, mockAssetAddress, undefined, {
                    gasLimit
                });
                await otherKumos[1].openTrove(troveCreationParams, mockAssetAddress, undefined, {
                    gasLimit
                });
                await otherKumos[2].openTrove(troveCreationParams, mockAssetAddress, undefined, {
                    gasLimit
                });

                await increaseTime(60 * 60 * 24 * 15);
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

            


            it(`should truncate the amount if it would put the last Trove below the min debt ${mockAssetContract.name}`, async () => {
                const redemption = await kumo.populate.redeemKUSD(mockAssetAddress, amountToAttempt);
                expect(`${redemption.attemptedKUSDAmount}`).to.equal(`${amountToAttempt}`);
                expect(`${redemption.redeemableKUSDAmount}`).to.equal(`${expectedRedeemable}`);
                expect(redemption.isTruncated).to.be.true;

                const { details } = await waitForSuccess(redemption.send());
                expect(`${details.attemptedKUSDAmount}`).to.equal(`${expectedRedeemable}`);
                expect(`${details.actualKUSDAmount}`).to.equal(`${expectedRedeemable}`);
            });
            it(`should increase the amount to the next lowest redeemable value ${mockAssetContract.name}`, async () => {
                const increasedRedeemable = expectedRedeemable.add(KUSD_MINIMUM_NET_DEBT);
                const initialRedemption = await kumo.populate.redeemKUSD(mockAssetAddress, amountToAttempt);
                const increasedRedemption = await initialRedemption.increaseAmountByMinimumNetDebt();
                expect(`${increasedRedemption.attemptedKUSDAmount}`).to.equal(`${increasedRedeemable}`);
                expect(`${increasedRedemption.redeemableKUSDAmount}`).to.equal(`${increasedRedeemable}`);
                expect(increasedRedemption.isTruncated).to.be.false;

                const { details } = await waitForSuccess(increasedRedemption.send());
                expect(`${details.attemptedKUSDAmount}`).to.equal(`${increasedRedeemable}`);
                expect(`${details.actualKUSDAmount}`).to.equal(`${increasedRedeemable}`);
            });
            it(`should fail to increase the amount if it's not truncated ${mockAssetContract.name}`, async () => {
                const redemption = await kumo.populate.redeemKUSD(mockAssetAddress, netDebtPerTrove);
                expect(redemption.isTruncated).to.be.false;

                expect(() => redemption.increaseAmountByMinimumNetDebt()).to.throw(
                    "can only be called when amount is truncated"
                );
            });
        });
    })
});

