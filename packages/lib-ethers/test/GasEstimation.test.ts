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
    TroveCreationParams
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


describe("EthersKumoGasEstimation", async () => {
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

    const openTroves = (users: Signer[], params: TroveCreationParams<Decimalish>[], mockAssetAddress: string) =>
        params
            .map(
                (params, i) => () =>
                    Promise.all([
                        connectToDeployment(deployment, users[i]),
                        sendTo(users[i], 0.1).then(tx => tx.wait())
                    ]).then(async ([kumo]) => {
                        await kumo.openTrove(params, mockAssetAddress, undefined, { gasLimit });
                    })
            )
            .reduce((a, b) => a.then(b), Promise.resolve());


    const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
        funder.sendTransaction({
            to: user.getAddress(),
            value: Decimal.from(value).add(GAS_BUDGET).hex,
            nonce
        });


    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Gas estimation ${mockAssetContract.name}`, () => {
            const troveWithICRBetween = (a: Trove, b: Trove) => a.add(b).multiply(0.5);
            let rudeUser: Signer;
            let fiveOtherUsers: Signer[];
            let rudeKumo: EthersKumo;
            before(async function () {
                if (network.name !== "hardhat") {
                    this.skip();
                }
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];

                [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

                [deployerKumo, kumo, rudeKumo, ...otherKumos] = await connectUsers([
                    deployer,
                    user,
                    rudeUser,
                    ...fiveOtherUsers
                ]);

                await openTroves(fiveOtherUsers, [
                    { depositCollateral: 20, borrowKUSD: 2040 },
                    { depositCollateral: 20, borrowKUSD: 2050 },
                    { depositCollateral: 20, borrowKUSD: 2060 },
                    { depositCollateral: 20, borrowKUSD: 2070 },
                    { depositCollateral: 20, borrowKUSD: 2080 }
                ], mockAssetAddress);

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

            it(`should include enough gas for updating lastFeeOperationTime ${mockAssetContract.name}`, async () => {
                await kumo.openTrove(
                    { depositCollateral: 20, borrowKUSD: 2090 },
                    mockAssetAddress,

                    undefined,
                    { gasLimit }
                );

                // We just updated lastFeeOperationTime, so this won't anticipate having to update that
                // during estimateGas
                const tx = await kumo.populate.redeemKUSD(mockAssetAddress, 1);
                const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

                // Fast-forward 2 minutes.
                await increaseTime(120);

                // Required gas has just went up.
                const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
                const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
                expect(gasIncrease).to.be.within(4000, 9000);

                // This will now have to update lastFeeOperationTime
                await waitForSuccess(tx.send());

                // Decay base-rate back to 0
                await increaseTime(100000000);
            });

            it(`should include enough gas for one extra traversal ${mockAssetContract.name}`, async () => {
                const troves = await kumo.getTroves(mockAssetAddress, {
                    first: 10,
                    sortedBy: "ascendingCollateralRatio"
                });

                const trove = await kumo.getTrove(mockAssetAddress);
                const newTrove = troveWithICRBetween(troves[4], troves[5]);

                // First, we want to test a non-borrowing case, to make sure we're not passing due to any
                // extra gas we add to cover a potential lastFeeOperationTime update
                const adjustment = trove.adjustTo(newTrove);
                expect(adjustment.borrowKUSD).to.be.undefined;

                const tx = await kumo.populate.adjustTrove(adjustment, mockAssetAddress);
                const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

                // A terribly rude user interferes
                const rudeTrove = newTrove.addDebt(1);
                const rudeCreation = Trove.recreate(rudeTrove);
                await openTroves([rudeUser], [rudeCreation], mockAssetAddress);

                const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
                const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

                await waitForSuccess(tx.send());
                expect(gasIncrease).to.be.within(10000, 25000);

                assertDefined(rudeCreation.borrowKUSD);
                const kusdShortage = rudeTrove.debt.sub(rudeCreation.borrowKUSD);

                await kumo.sendKUSD(await rudeUser.getAddress(), kusdShortage);
                await rudeKumo.closeTrove(mockAssetAddress);
            });

            it(`should include enough gas for both when borrowing ${mockAssetContract.name}`, async () => {
                const troves = await kumo.getTroves(mockAssetAddress, {
                    first: 10,
                    sortedBy: "ascendingCollateralRatio"
                });

                const trove = await kumo.getTrove(mockAssetAddress);
                const newTrove = troveWithICRBetween(troves[1], troves[2]);

                // Make sure we're borrowing
                const adjustment = trove.adjustTo(newTrove);
                expect(adjustment.borrowKUSD).to.not.be.undefined;

                const tx = await kumo.populate.adjustTrove(adjustment, mockAssetAddress);
                const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

                // A terribly rude user interferes again
                await openTroves([rudeUser], [Trove.recreate(newTrove.addDebt(1))], mockAssetAddress);

                // On top of that, we'll need to update lastFeeOperationTime
                await increaseTime(120);

                const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
                const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

                await waitForSuccess(tx.send());
                expect(gasIncrease).to.be.within(15000, 30000);
            });

        });
    })
});

