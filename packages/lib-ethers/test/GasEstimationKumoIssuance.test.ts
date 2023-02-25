import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Decimal,
    Trove,
    KumoReceipt,
    SuccessfulReceipt,
    SentKumoTransaction
} from "@kumodao/lib-base";


import {
    PopulatedEthersKumoTransaction,
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

function assertDefined<T>(actual: T | undefined): asserts actual is T {
    assert(actual !== undefined);
}


const waitForSuccess = async <T extends KumoReceipt>(
    tx: Promise<SentKumoTransaction<unknown, T>>
) => {
    const receipt = await (await tx).waitForReceipt();
    assertStrictEqual(receipt.status, "succeeded" as const);

    return receipt as Extract<T, SuccessfulReceipt>;
};

const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const


describe("EthersKumoGasEstimationKumoIssuance", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let deployerKumo: EthersKumo;
    let kumo: EthersKumo;



    let mockAssetAddress: string;

    const gasLimit = BigNumber.from(2500000);



    const connectUsers = (users: Signer[]) =>
        Promise.all(users.map(user => connectToDeployment(deployment, user)));




    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Gas estimation (KUMO issuance) ${mockAssetContract.name}`, () => {
            const estimate = (tx: PopulatedEthersKumoTransaction) =>
                provider.estimateGas(tx.rawPopulatedTransaction);

            before(async function () {
                if (network.name !== "hardhat") {
                    this.skip();
                }
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();

                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                [deployerKumo, kumo] = await connectUsers([deployer, user]);

            });

            // Always setup same initial balance for user
            // beforeEach(async () => {
            //     const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

            //     const gasPrice = BigNumber.from(100e9); // 100 Gwei

            //     const balance = await user.getBalance();
            //     const txCost = gasLimit.mul(gasPrice);

            //     if (balance.eq(targetBalance)) {
            //         return;
            //     }

            //     if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
            //         await funder.sendTransaction({
            //             to: user.getAddress(),
            //             value: targetBalance.add(txCost).sub(balance).add(1),
            //             gasLimit,
            //             gasPrice
            //         });

            //         await user.sendTransaction({
            //             to: funder.getAddress(),
            //             value: 1,
            //             gasLimit,
            //             gasPrice
            //         });
            //     } else {
            //         if (balance.lt(targetBalance)) {
            //             await funder.sendTransaction({
            //                 to: user.getAddress(),
            //                 value: targetBalance.sub(balance),
            //                 gasLimit,
            //                 gasPrice
            //             });
            //         } else {
            //             await user.sendTransaction({
            //                 to: funder.getAddress(),
            //                 value: balance.sub(targetBalance).sub(txCost),
            //                 gasLimit,
            //                 gasPrice
            //             });
            //         }
            //     }
            //     expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
            // });

            it(`should include enough gas for issuing KUMO ${mockAssetContract.name}`, async function () {
                this.timeout("1m");

                await kumo.openTrove(
                    { depositCollateral: 40, borrowKUSD: 4000 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                await kumo.depositKUSDInStabilityPool(19, mockAssetContract.name);

                await increaseTime(60);

                // This will issue KUMO for the first time ever. That uses a whole lotta gas, and we don't
                // want to pack any extra gas to prepare for this case specifically, because it only happens
                // once.
                await kumo.withdrawGainsFromStabilityPool(mockAssetContract.name);

                const claim = await kumo.populate.withdrawGainsFromStabilityPool(mockAssetContract.name);
                const deposit = await kumo.populate.depositKUSDInStabilityPool(1, mockAssetContract.name);
                const withdraw = await kumo.populate.withdrawKUSDFromStabilityPool(1, mockAssetContract.name);

                for (let i = 0; i < 5; ++i) {
                    for (const tx of [claim, deposit, withdraw]) {
                        const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
                        const requiredGas = (await estimate(tx)).toNumber();

                        assertDefined(gasLimit);
                        expect(requiredGas).to.be.at.most(gasLimit);
                    }

                    await increaseTime(60);
                }

                await waitForSuccess(claim.send());

                const creation = Trove.recreate(new Trove(Decimal.from(11.1), Decimal.from(2000.1)));

                await deployerKumo.openTrove(creation, mockAssetAddress, undefined, { gasLimit });
                await deployerKumo.depositKUSDInStabilityPool(creation.borrowKUSD, mockAssetContract.name);
                await deployerKumo.setPrice(mockAssetAddress, 198);

                const liquidateTarget = await kumo.populate.liquidate(mockAssetAddress, await deployer.getAddress());
                const liquidateMultiple = await kumo.populate.liquidateUpTo(mockAssetAddress, 40);

                for (let i = 0; i < 5; ++i) {
                    for (const tx of [liquidateTarget, liquidateMultiple]) {
                        const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
                        const requiredGas = (await estimate(tx)).toNumber();

                        assertDefined(gasLimit);
                        expect(requiredGas).to.be.at.most(gasLimit);
                    }

                    await increaseTime(60);
                }

                await waitForSuccess(liquidateMultiple.send());
            });

        });
    })
});