import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal,
    Trove,
    StabilityDeposit,
    KUSD_LIQUIDATION_RESERVE,
    KUSD_MINIMUM_DEBT,
    KUSD_MINIMUM_NET_DEBT
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { STARTING_BALANCE } from "../testUtils/constants";
import { connectToDeployment, connectUsers, setUpInitialUserBalance } from "../testUtils";
import { mockAssetContracts } from "../testUtils/types";

chai.use(chaiAsPromised);
chai.use(chaiSpies);


describe("EthersKumoStabilityPool", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let deployerKumo: EthersKumo;
    let kumo: EthersKumo;
    let otherKumos: EthersKumo[];

    const gasLimit = BigNumber.from(2500000);

    let mockAssetAddress: string;

    before(async () => {
        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
        deployment = await deployKumo(deployer);

        kumo = await connectToDeployment(deployment, user);
        expect(kumo).to.be.an.instanceOf(EthersKumo);

        [deployerKumo, kumo, ...otherKumos] = await connectUsers(deployment, [
            deployer,
            user,
            ...otherUsers.slice(0, 1)
        ]);

        await funder.sendTransaction({
            to: otherUsers[0].getAddress(),
            value: KUSD_MINIMUM_DEBT.div(170).hex
        });
    });

    // Always setup same initial balance for user
    beforeEach(async () => {
        const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

        await setUpInitialUserBalance(user, funder, gasLimit);
        expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
    });



    describe("StabilityPool Multi Asset", () => {
        const initialTroveOfDepositor = Trove.create({
            depositCollateral: KUSD_MINIMUM_DEBT.div(100),
            borrowKUSD: KUSD_MINIMUM_NET_DEBT
        });

        const smallStabilityDeposit = Decimal.from(10);

        it(`should make a small stability deposit`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove } = await kumo.openTrove(
                    Trove.recreate(initialTroveOfDepositor),
                    mockAssetAddress,
                );
                const details = await kumo.depositKUSDInStabilityPool(smallStabilityDeposit, mockAssetContract.name);
                return { newTrove, details }
            })

            let systemKusdInStabilityPool = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, details } = trove
                systemKusdInStabilityPool = systemKusdInStabilityPool.add(details.newKUSDDeposit)
                expect(newTrove).to.deep.equal(initialTroveOfDepositor);
                expect(details).to.deep.equal({
                    kusdLoss: Decimal.from(0),
                    newKUSDDeposit: smallStabilityDeposit,
                    collateralGain: Decimal.from(0),
                    kumoReward: Decimal.from(0),
                    change: {
                        depositKUSD: smallStabilityDeposit
                    }
                });
            }
            expect(`${systemKusdInStabilityPool}`).to.equal(`${smallStabilityDeposit.mul(newTroves.length)}`)
        })

        const troveWithVeryLowICR = Trove.create({
            depositCollateral: KUSD_MINIMUM_DEBT.div(180),
            borrowKUSD: KUSD_MINIMUM_NET_DEBT
        });

        it(`other user should make a Trove with very low ICR`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove } = await otherKumos[0].openTrove(
                    Trove.recreate(troveWithVeryLowICR),
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                return { newTrove, mockAssetAddress }
            })

            for await (const trove of newTroves) {
                const { newTrove, mockAssetAddress } = trove
                const price = await kumo.getPrice(mockAssetAddress);
                expect(Number(`${newTrove.collateralRatio(price)}`)).to.be.below(1.15);
            }
        });

        const dippedPrice = Decimal.from(190);

        it(`the price should take a dip`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                await deployerKumo.setPrice(mockAssetAddress, dippedPrice);
                return { mockAssetAddress }
            });

            for await (const trove of newTroves) {
                const { mockAssetAddress } = trove
                const price = await kumo.getPrice(mockAssetAddress);
                expect(`${price}`).to.equal(`${dippedPrice}`);
            }
        })

        it(`should liquidate other user's Trove`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const details = await kumo.liquidateUpTo(mockAssetAddress, 1, { gasLimit });
                return { details, mockAssetAddress }
            });

            for await (const trove of newTroves) {
                const { details, mockAssetAddress } = trove
                const otherTrove = await otherKumos[0].getTrove(mockAssetAddress);
                expect(details).to.deep.equal({
                    liquidatedAddresses: [await otherUsers[0].getAddress()],
                    collateralGasCompensation: troveWithVeryLowICR.collateral.mul(0.005), // 0.5%
                    kusdGasCompensation: KUSD_LIQUIDATION_RESERVE,

                    totalLiquidated: new Trove(
                        troveWithVeryLowICR.collateral
                            .mul(0.995) // -0.5% gas compensation
                            .add("0.000000000000000001"), // tiny imprecision
                        troveWithVeryLowICR.debt
                    )
                });
                expect(otherTrove.isEmpty).to.be.true;
            }
        })

        it(`should have a depleted stability deposit and some collateral gain`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const stabilityDeposit = await kumo.getStabilityDeposit(mockAssetContract.name);
                return { stabilityDeposit }
            });

            for await (const trove of newTroves) {
                const { stabilityDeposit } = trove
                expect(stabilityDeposit).to.deep.equal(
                    new StabilityDeposit(
                        smallStabilityDeposit,
                        Decimal.ZERO,
                        troveWithVeryLowICR.collateral
                            .mul(0.995) // -0.5% gas compensation
                            .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
                            .sub("0.000000000000000005"), // tiny imprecision
                        Decimal.ZERO
                    )
                );
            }
        })
        it(`the Trove should have received some liquidation shares`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const newTrove = await kumo.getTrove(mockAssetAddress);
                return { newTrove }
            });

            for await (const trove of newTroves) {
                const { newTrove } = trove
                expect(newTrove).to.deep.equal({
                    ownerAddress: await user.getAddress(),
                    status: "open",

                    ...initialTroveOfDepositor
                        .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
                        .addCollateral(
                            troveWithVeryLowICR.collateral
                                .mul(0.995) // -0.5% gas compensation
                                .mulDiv(troveWithVeryLowICR.debt.sub(smallStabilityDeposit), troveWithVeryLowICR.debt)
                                .add("0.000000000000000001") // tiny imprecision
                        )
                });
            }

        })

        it(`total should equal the Trove`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const newTrove = await kumo.getTrove(mockAssetAddress);
                const numberOfTroves = await kumo.getNumberOfTroves(mockAssetAddress);
                const total = await kumo.getTotal(mockAssetAddress);
                return { newTrove, numberOfTroves, total }
            });

            for await (const trove of newTroves) {
                const { newTrove, numberOfTroves, total } = trove
                expect(numberOfTroves).to.equal(1);
                expect(total).to.deep.equal(
                    newTrove.addCollateral("0.000000000000000001") // tiny imprecision
                );
            }

        })

        it(`should transfer the gains to the Trove`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const details = await kumo.transferCollateralGainToTrove(mockAssetAddress, mockAssetContract.name, { gasLimit });
                const stabilityDeposit = await kumo.getStabilityDeposit(mockAssetContract.name);
                return { details, stabilityDeposit }
            });

            for await (const trove of newTroves) {
                const { details, stabilityDeposit } = trove
                expect(details).to.deep.equal({
                    kusdLoss: smallStabilityDeposit,
                    newKUSDDeposit: Decimal.ZERO,
                    kumoReward: Decimal.ZERO,

                    collateralGain: troveWithVeryLowICR.collateral
                        .mul(0.995) // -0.5% gas compensation
                        .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
                        .sub("0.000000000000000005"), // tiny imprecision

                    newTrove: initialTroveOfDepositor
                        .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
                        .addCollateral(
                            troveWithVeryLowICR.collateral
                                .mul(0.995) // -0.5% gas compensation
                                .sub("0.000000000000000005") // tiny imprecision
                        )
                });
                expect(stabilityDeposit.isEmpty).to.be.true;
            }
        })

    })



    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`StabilityPool Multi Asset Independent tests ${mockAssetContract.name}`, () => {
            before(async () => {
                // Deploy new instances of the contracts, for a clean state
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                // Deploy new instances of the contracts, for a clean state
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];

                kumo = await connectToDeployment(deployment, user);
                expect(kumo).to.be.an.instanceOf(EthersKumo);

                [deployerKumo, kumo, ...otherKumos] = await connectUsers(deployment, [
                    deployer,
                    user,
                    ...otherUsers.slice(0, 1)
                ]);

                await funder.sendTransaction({
                    to: otherUsers[0].getAddress(),
                    value: KUSD_MINIMUM_DEBT.div(170).hex
                });
            });

            
            afterEach(`Run after each test ${mockAssetContract.name}`, async () => {
                let calculatedkusdInStabilityPool = Decimal.ZERO
                let totalCurrentKusdInStabilityPool = Decimal.ZERO

                const otherMockAssetContracts = mockAssetContracts.filter(contract => contract.name !== mockAssetContract.name)
                const currentKusdInStabilityPool = await kumo.getKUSDInStabilityPool(mockAssetContract.name)

                for await (const otherMockContract of otherMockAssetContracts) {
                    calculatedkusdInStabilityPool = calculatedkusdInStabilityPool.add(await kumo.getKUSDInStabilityPool(otherMockContract.name))
                    const stabilityDeposit = await kumo.getStabilityDeposit(otherMockContract.name)
                    totalCurrentKusdInStabilityPool = totalCurrentKusdInStabilityPool.add(stabilityDeposit.currentKUSD)
                    expect(`${stabilityDeposit.currentKUSD}`).to.equal("0")
                    expect(stabilityDeposit.isEmpty).to.be.true
                }

                expect(`${currentKusdInStabilityPool.mul(calculatedkusdInStabilityPool)}`).to.equal("0")
                expect(`${totalCurrentKusdInStabilityPool}`).to.equal("0")

            })

            const initialTroveOfDepositor = Trove.create({
                depositCollateral: KUSD_MINIMUM_DEBT.div(100),
                borrowKUSD: KUSD_MINIMUM_NET_DEBT
            });

            const smallStabilityDeposit = Decimal.from(10);

            it(`should make a small stability deposit ${mockAssetContract.name}`, async () => {
                const { newTrove } = await kumo.openTrove(
                    Trove.recreate(initialTroveOfDepositor),
                    mockAssetAddress,
                );
                expect(newTrove).to.deep.equal(initialTroveOfDepositor);
                const details = await kumo.depositKUSDInStabilityPool(smallStabilityDeposit, mockAssetContract.name);
                expect(details).to.deep.equal({
                    kusdLoss: Decimal.from(0),
                    newKUSDDeposit: smallStabilityDeposit,
                    collateralGain: Decimal.from(0),
                    kumoReward: Decimal.from(0),
                    change: {
                        depositKUSD: smallStabilityDeposit
                    }
                });
            })

            const troveWithVeryLowICR = Trove.create({
                depositCollateral: KUSD_MINIMUM_DEBT.div(180),
                borrowKUSD: KUSD_MINIMUM_NET_DEBT
            });

            it(`other user should make a Trove with very low ICR ${mockAssetContract.name}`, async () => {
                const { newTrove } = await otherKumos[0].openTrove(
                    Trove.recreate(troveWithVeryLowICR),
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );

                const price = await kumo.getPrice(mockAssetAddress);
                expect(Number(`${newTrove.collateralRatio(price)}`)).to.be.below(1.15);
            });

            const dippedPrice = Decimal.from(190);

            it(`the price should take a dip ${mockAssetContract.name}`, async () => {
                await deployerKumo.setPrice(mockAssetAddress, dippedPrice);
                const price = await kumo.getPrice(mockAssetAddress);
                expect(`${price}`).to.equal(`${dippedPrice}`);
            });

            it(`should liquidate other user's Trove ${mockAssetContract.name}`, async () => {
                const details = await kumo.liquidateUpTo(mockAssetAddress, 1, { gasLimit });

                expect(details).to.deep.equal({
                    liquidatedAddresses: [await otherUsers[0].getAddress()],
                    collateralGasCompensation: troveWithVeryLowICR.collateral.mul(0.005), // 0.5%
                    kusdGasCompensation: KUSD_LIQUIDATION_RESERVE,

                    totalLiquidated: new Trove(
                        troveWithVeryLowICR.collateral
                            .mul(0.995) // -0.5% gas compensation
                            .add("0.000000000000000001"), // tiny imprecision
                        troveWithVeryLowICR.debt
                    )
                });

                const otherTrove = await otherKumos[0].getTrove(mockAssetAddress);
                expect(otherTrove.isEmpty).to.be.true;
            });

            it(`should have a depleted stability deposit and some collateral gain ${mockAssetContract.name}`, async () => {
                const stabilityDeposit = await kumo.getStabilityDeposit(mockAssetContract.name);

                expect(stabilityDeposit).to.deep.equal(
                    new StabilityDeposit(
                        smallStabilityDeposit,
                        Decimal.ZERO,
                        troveWithVeryLowICR.collateral
                            .mul(0.995) // -0.5% gas compensation
                            .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
                            .sub("0.000000000000000005"), // tiny imprecision
                        Decimal.ZERO
                    )
                );
            });

            it(`the Trove should have received some liquidation shares ${mockAssetContract.name}`, async () => {
                const trove = await kumo.getTrove(mockAssetAddress);

                expect(trove).to.deep.equal({
                    ownerAddress: await user.getAddress(),
                    status: "open",

                    ...initialTroveOfDepositor
                        .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
                        .addCollateral(
                            troveWithVeryLowICR.collateral
                                .mul(0.995) // -0.5% gas compensation
                                .mulDiv(troveWithVeryLowICR.debt.sub(smallStabilityDeposit), troveWithVeryLowICR.debt)
                                .add("0.000000000000000001") // tiny imprecision
                        )
                });
            });

            it(`total should equal the Trove ${mockAssetContract.name}`, async () => {
                const trove = await kumo.getTrove(mockAssetAddress);

                const numberOfTroves = await kumo.getNumberOfTroves(mockAssetAddress);
                expect(numberOfTroves).to.equal(1);

                const total = await kumo.getTotal(mockAssetAddress);
                expect(total).to.deep.equal(
                    trove.addCollateral("0.000000000000000001") // tiny imprecision
                );
            });

            it(`should transfer the gains to the Trove ${mockAssetContract.name}`, async () => {
                const details = await kumo.transferCollateralGainToTrove(mockAssetAddress, mockAssetContract.name, { gasLimit });

                expect(details).to.deep.equal({
                    kusdLoss: smallStabilityDeposit,
                    newKUSDDeposit: Decimal.ZERO,
                    kumoReward: Decimal.ZERO,

                    collateralGain: troveWithVeryLowICR.collateral
                        .mul(0.995) // -0.5% gas compensation
                        .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
                        .sub("0.000000000000000005"), // tiny imprecision

                    newTrove: initialTroveOfDepositor
                        .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
                        .addCollateral(
                            troveWithVeryLowICR.collateral
                                .mul(0.995) // -0.5% gas compensation
                                .sub("0.000000000000000005") // tiny imprecision
                        )
                });

                const stabilityDeposit = await kumo.getStabilityDeposit(mockAssetContract.name);
                expect(stabilityDeposit.isEmpty).to.be.true;
            });
        })
    })
});
