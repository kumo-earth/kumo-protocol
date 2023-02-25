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
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";


const ERC20ABI = require("../abi/ERC20Test.json")

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

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





const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const

interface MockAssets {
    assetName: string, assetAddress: string, assetContract: any
}

// TODO make the testcases isolated

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


    const connectUsers = (users: Signer[]) =>
        Promise.all(users.map(user => connectToDeployment(deployment, user)));

    // before(async () => {
    //     [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    //     deployment = await deployKumo(deployer);
    //     kumo = await connectToDeployment(deployment, user);

    //     expect(kumo).to.be.an.instanceOf(EthersKumo);

    // });

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

    //     console.log("targetBalance", targetBalance.toString())
    //     expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
    // });

    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`StabilityPool - TEST ${mockAssetContract.name}`, () => {
            before(async () => {
                // Deploy new instances of the contracts, for a clean state
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                // Deploy new instances of the contracts, for a clean state
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];

                kumo = await connectToDeployment(deployment, user);
                expect(kumo).to.be.an.instanceOf(EthersKumo);

                [deployerKumo, kumo, ...otherKumos] = await connectUsers([
                    deployer,
                    user,
                    ...otherUsers.slice(0, 1)
                ]);

                await funder.sendTransaction({
                    to: otherUsers[0].getAddress(),
                    value: KUSD_MINIMUM_DEBT.div(170).hex
                });
            });
            // // Always setup same initial balance for user
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
                        Decimal.ZERO,
                        AddressZero
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

