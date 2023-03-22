import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Trove
} from "@kumodao/lib-base";

import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";
import { STARTING_BALANCE } from "../testUtils/constants";
import { assertDefined, connectToDeployment, connectUsers, increaseTime, openTroves, setUpInitialUserBalance, waitForSuccess } from "../testUtils";
import { mockAssetContracts } from "../testUtils/types";


const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


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

        kumo = await connectToDeployment(deployment, user);

        expect(kumo).to.be.an.instanceOf(EthersKumo);

        [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

        [deployerKumo, kumo, rudeKumo, ...otherKumos] = await connectUsers(deployment, [
            deployer,
            user,
            rudeUser,
            ...fiveOtherUsers
        ]);
    });

    describe("Gas Esitimation Bootstrap phase Multi Asset", () => {
        before(async () => {
            for (const mockAssetContract of mockAssetContracts) {
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                await openTroves(deployment, fiveOtherUsers, funder, [
                    { depositCollateral: 20, borrowKUSD: 2040 },
                    { depositCollateral: 20, borrowKUSD: 2050 },
                    { depositCollateral: 20, borrowKUSD: 2060 },
                    { depositCollateral: 20, borrowKUSD: 2070 },
                    { depositCollateral: 20, borrowKUSD: 2080 }
                ], mockAssetAddress, gasLimit);


            }

            await increaseTime(60 * 60 * 24 * 15);
        })

        it(`should include enough gas for updating lastFeeOperationTime`, async () => {
            let increasedGas = 0
            for await (const mockAssetContract of mockAssetContracts) {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
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
                increasedGas += gasIncrease

                expect(gasIncrease).to.be.within(4000, 9000);

                // This will now have to update lastFeeOperationTime
                await waitForSuccess(tx.send());

                // Decay base-rate back to 0
                await increaseTime(100000000);

            }
            expect(increasedGas).to.be.within((4000 * mockAssetContracts.length), (9000 * mockAssetContracts.length));
        })
        it(`should include enough gas for one extra traversal`, async () => {
            let increasedGas = 0
            for await (const mockAssetContract of mockAssetContracts) {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
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
                await openTroves(deployment, [rudeUser], funder, [rudeCreation], mockAssetAddress, gasLimit);

                const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
                const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
                increasedGas += gasIncrease
                await waitForSuccess(tx.send());
                expect(gasIncrease).to.be.within(10000, 25000);

                assertDefined(rudeCreation.borrowKUSD);
                const kusdShortage = rudeTrove.debt.sub(rudeCreation.borrowKUSD);

                await kumo.sendKUSD(await rudeUser.getAddress(), kusdShortage);
                await rudeKumo.closeTrove(mockAssetAddress);
            }
            expect(increasedGas).to.be.within((10000 * mockAssetContracts.length), (25000 * mockAssetContracts.length));
        })

        it(`should include enough gas for both when borrowing`, async () => {
            let increasedGas = 0
            for await (const mockAssetContract of mockAssetContracts) {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
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
                await openTroves(deployment, [rudeUser], funder, [Trove.recreate(newTrove.addDebt(1))], mockAssetAddress, gasLimit);

                // On top of that, we'll need to update lastFeeOperationTime
                await increaseTime(120);

                const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
                const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
                increasedGas += gasIncrease
                await waitForSuccess(tx.send());
                expect(gasIncrease).to.be.within(15000, 30000);
            }

            expect(increasedGas).to.be.within((15000 * mockAssetContracts.length), (30000 * mockAssetContracts.length));

        })
    })

    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Gas estimation Multi Asset Independent tests ${mockAssetContract.name}`, () => {
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
                kumo = await connectToDeployment(deployment, user);

                expect(kumo).to.be.an.instanceOf(EthersKumo);

                [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

                [deployerKumo, kumo, rudeKumo, ...otherKumos] = await connectUsers(deployment, [
                    deployer,
                    user,
                    rudeUser,
                    ...fiveOtherUsers
                ]);

                await openTroves(deployment, fiveOtherUsers, funder, [
                    { depositCollateral: 20, borrowKUSD: 2040 },
                    { depositCollateral: 20, borrowKUSD: 2050 },
                    { depositCollateral: 20, borrowKUSD: 2060 },
                    { depositCollateral: 20, borrowKUSD: 2070 },
                    { depositCollateral: 20, borrowKUSD: 2080 }
                ], mockAssetAddress, gasLimit);

                await increaseTime(60 * 60 * 24 * 15);

            });

            // Always setup same initial balance for user
            beforeEach(async () => {
                const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

                await setUpInitialUserBalance(user, funder, gasLimit)
                expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
            });

            afterEach(`Run after each test ${mockAssetContract.name}`, async () => {
                let totalTroves = 0
                const otherMockAssetContracts = mockAssetContracts.filter(contract => contract.name !== mockAssetContract.name)
                const currentTroves =  await kumo.getTroves(mockAssetAddress, {
                    first: 10,
                    sortedBy: "ascendingCollateralRatio"
                });

                for await (const otherMockContract of otherMockAssetContracts) {
                    const mockAssetAddress = deployment.addresses[otherMockContract.contract];
                    const troves = await kumo.getTroves(mockAssetAddress, {
                        first: 10,
                        sortedBy: "ascendingCollateralRatio"
                    });
                    totalTroves +=  troves.length
                    expect(`${troves.length}`).to.equal("0")
                }
                expect(`${currentTroves.length * totalTroves}`).to.equal("0")
            })

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
                await openTroves(deployment, [rudeUser], funder, [rudeCreation], mockAssetAddress, gasLimit);

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
                await openTroves(deployment, [rudeUser], funder, [Trove.recreate(newTrove.addDebt(1))], mockAssetAddress, gasLimit);

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

