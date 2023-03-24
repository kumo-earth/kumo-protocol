import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal,
    KUSD_MINIMUM_DEBT,
    KUSD_MINIMUM_NET_DEBT,
    MINIMUM_BORROWING_RATE,
    Trove
} from "@kumodao/lib-base";

import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";
import { STARTING_BALANCE } from "../testUtils/constants";
import { connectToDeployment, setUpInitialUserBalance, waitForSuccess } from "../testUtils";
import { mockAssetContracts } from "../testUtils/types";
const ERC20ABI = require("../abi/ERC20Test.json")

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


describe("EthersKumoGasEstimation", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;
    let kumo: EthersKumo;

    let mockAssetAddress: string;

    const gasLimit = BigNumber.from(2500000);

    before(async () => {
        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
        deployment = await deployKumo(deployer);
        kumo = await connectToDeployment(deployment, user);

        expect(kumo).to.be.an.instanceOf(EthersKumo);
    });

    // Always setup same initial balance for user
    beforeEach(async () => {
        const targetBalance = BigNumber.from(STARTING_BALANCE.hex);
        await setUpInitialUserBalance(user, funder, gasLimit)
        expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
    });

    describe("Trove Initial Tests", () => {
        for (const mockAssetContract of mockAssetContracts) {
            it(`should have no Trove initially ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const trove = await kumo.getTrove(mockAssetAddress);
                expect(trove.isEmpty).to.be.true;
            });

            it(`should fail to create an undercollateralized Trove ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const price = await kumo.getPrice(mockAssetAddress);
                const undercollateralized = new Trove(KUSD_MINIMUM_DEBT.div(price), KUSD_MINIMUM_DEBT);
                await expect(kumo.openTrove(Trove.recreate(undercollateralized), mockAssetAddress)).to
                    .eventually.be.rejected;
            });

            it(`should fail to create a Trove with too little debt ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const withTooLittleDebt = new Trove(Decimal.from(50), KUSD_MINIMUM_DEBT.sub(1));

                await expect(kumo.openTrove(Trove.recreate(withTooLittleDebt), mockAssetAddress)).to
                    .eventually.be.rejected;
            });
        }
    })

    describe("Trove Tests for system state with Multi Asset support", () => {
        const assetTVL = async (trove: Trove, assetAddress: string): Promise<Decimal> => {
            return trove.collateral.mul(await kumo.getPrice(assetAddress))
        }

        before(async () => {
            for await (const mockAssetContract of mockAssetContracts) {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                await kumo.setPrice(mockAssetAddress, 200)
                const price = await kumo.getPrice(mockAssetAddress)
                expect(`${price}`).to.equal("200")
            }
        })

        const withSomeBorrowing = { depositCollateral: 50, borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(100) };

        it(`should individual trove TVL equals to System TVL`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove, fee } = await kumo.openTrove(
                    withSomeBorrowing,
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                const assetValue = await assetTVL(newTrove, mockAssetAddress)
                return { newTrove, fee, assetValue }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, fee, assetValue } = trove
                SystemTVL = SystemTVL.add(assetValue)
                expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing));
                expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(withSomeBorrowing.borrowKUSD)}`);
                expect(`${assetValue}`).to.equal(`${newTrove.collateral.mul(200)}`)
            }
            expect(`${SystemTVL}`).to.equal(`${(withSomeBorrowing.depositCollateral * newTroves.length) * 200}`)
        })

        it(`should fail to withdraw all the collateral while the Trove has debt`, async () => {
            for await (const mockAssetContract of mockAssetContracts) {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const trove = await kumo.getTrove(mockAssetAddress);
                await expect(kumo.withdrawCollateral(mockAssetAddress, trove.collateral)).to.eventually.be.rejected;
            }
        });


        const repaySomeDebt = { repayKUSD: 10 };

        it(`should individual Trove repay some debt and adjust System TVL`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove, fee } = await kumo.repayKUSD(mockAssetAddress, repaySomeDebt.repayKUSD);
                const assetValue = await assetTVL(newTrove, mockAssetAddress)
                return { newTrove, fee, assetValue }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, fee, assetValue } = trove
                SystemTVL = SystemTVL.add(assetValue)
                expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing).adjust(repaySomeDebt));
                expect(`${fee}`).to.equal("0");
                expect(`${assetValue}`).to.equal(`${newTrove.collateral.mul(200)}`)
            }

            expect(`${SystemTVL}`).to.equal(`${((Trove.create(withSomeBorrowing).adjust(repaySomeDebt)).collateral.mul(newTroves.length).mul(200))}`)
        });

        const borrowSomeMore = { borrowKUSD: 20 };
        it(`should individual trove borrow some more and adjust System TVL`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove, fee } = await kumo.borrowKUSD(mockAssetAddress, borrowSomeMore.borrowKUSD);
                const assetValue = await assetTVL(newTrove, mockAssetAddress)
                return { newTrove, fee, assetValue }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, fee, assetValue } = trove
                SystemTVL = SystemTVL.add(assetValue)
                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing).adjust(repaySomeDebt).adjust(borrowSomeMore)
                );
                expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowSomeMore.borrowKUSD)}`);
                expect(`${assetValue}`).to.equal(`${newTrove.collateral.mul(200)}`)
            }

            expect(`${SystemTVL}`).to.equal(`${((Trove.create(withSomeBorrowing).adjust(repaySomeDebt).adjust(borrowSomeMore)).collateral.mul(newTroves.length).mul(200))}`)

        })

        const depositMoreCollateral = { depositCollateral: 1 };

        it(`should deposit more collateral for each trove and adjust System TVL`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove } = await kumo.depositCollateral(
                    mockAssetAddress,
                    depositMoreCollateral.depositCollateral
                );
                const assetValue = await assetTVL(newTrove, mockAssetAddress)
                return { newTrove, assetValue }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, assetValue } = trove
                SystemTVL = SystemTVL.add(assetValue)
                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing)
                        .adjust(repaySomeDebt)
                        .adjust(borrowSomeMore)
                        .adjust(depositMoreCollateral)
                );

                expect(`${assetValue}`).to.equal(`${newTrove.collateral.mul(200)}`)
            }
            expect(`${SystemTVL}`).to.equal(`${((Trove.create(withSomeBorrowing)
                .adjust(repaySomeDebt)
                .adjust(borrowSomeMore)
                .adjust(depositMoreCollateral)).collateral.mul(newTroves.length).mul(200))}`)

        })

        const repayAndWithdraw = { repayKUSD: 60, withdrawCollateral: 0.5 };

        it(`should repay some debt for each trove and withdraw some collateral at the same time and adjust System TVL`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
                const {
                    rawReceipt,
                    details: { newTrove }
                } = await waitForSuccess(kumo.send.adjustTrove(repayAndWithdraw, mockAssetAddress));
                const assetValue = await assetTVL(newTrove, mockAssetAddress)
                return { newTrove, assetValue, mockContract }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, assetValue, mockContract } = trove
                SystemTVL = SystemTVL.add(assetValue)
                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing)
                        .adjust(repaySomeDebt)
                        .adjust(borrowSomeMore)
                        .adjust(depositMoreCollateral)
                        .adjust(repayAndWithdraw)
                );
                const assetBalance = await mockContract.balanceOf(user.getAddress())
                const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(500).sub(451).add(0.5).hex);
                expect(`${assetBalance}`).to.equal(`${expectedBalance}`);
            }

            expect(`${SystemTVL}`).to.equal(`${((Trove.create(withSomeBorrowing)
                .adjust(repaySomeDebt)
                .adjust(borrowSomeMore)
                .adjust(depositMoreCollateral)
                .adjust(repayAndWithdraw)).collateral.mul(newTroves.length).mul(200))}`)
        })
        const borrowAndDeposit = { borrowKUSD: 60, depositCollateral: 0.5 };

        it(`should borrow more and deposit some collateral at the same time for each trove and adjust System TVL`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
                const {
                    rawReceipt,
                    details: { newTrove, fee }
                } = await waitForSuccess(kumo.send.adjustTrove(borrowAndDeposit, mockAssetAddress));
                const assetValue = await assetTVL(newTrove, mockAssetAddress)
                return { newTrove, fee, assetValue, mockContract }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { newTrove, fee, assetValue, mockContract } = trove
                SystemTVL = SystemTVL.add(assetValue)

                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing)
                        .adjust(repaySomeDebt)
                        .adjust(borrowSomeMore)
                        .adjust(depositMoreCollateral)
                        .adjust(repayAndWithdraw)
                        .adjust(borrowAndDeposit)
                );

                expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowAndDeposit.borrowKUSD)}`);
                const assetBalance = await mockContract.balanceOf(user.getAddress())
                const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(500).sub(451).add(0.5).sub(0.5).hex);
                expect(`${assetBalance}`).to.equal(`${expectedBalance}`);

            }
            expect(`${SystemTVL}`).to.equal(`${((Trove.create(withSomeBorrowing)
                .adjust(repaySomeDebt)
                .adjust(borrowSomeMore)
                .adjust(depositMoreCollateral)
                .adjust(repayAndWithdraw)
                .adjust(borrowAndDeposit)).collateral.mul(newTroves.length).mul(200))}`)
        })

        it(`should close each Trove with some KUSD from another user and System TVL should be ZERO`, async () => {
            const newTroves = mockAssetContracts.map(async mockAssetContract => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const price = await kumo.getPrice(mockAssetAddress);
                const initialTrove = await kumo.getTrove(mockAssetAddress);
                const kusdBalance = await kumo.getKUMOBalance(mockAssetAddress);
                const kusdShortage = initialTrove.netDebt.sub(kusdBalance);

                let funderTrove = Trove.create({ depositCollateral: 1, borrowKUSD: kusdShortage });
                funderTrove = funderTrove.setDebt(Decimal.max(funderTrove.debt, KUSD_MINIMUM_DEBT));
                funderTrove = funderTrove.setCollateral(funderTrove.debt.mulDiv(1.51, price));

                const funderKumo = await connectToDeployment(deployment, funder);
                await funderKumo.openTrove(Trove.recreate(funderTrove), mockAssetAddress, undefined, {
                    gasLimit
                });
                await funderKumo.sendKUSD(await user.getAddress(), kusdShortage);

                const { params } = await kumo.closeTrove(mockAssetAddress);

                return { params, initialTrove, mockAssetAddress }
            })

            let SystemTVL = Decimal.ZERO

            for await (const trove of newTroves) {
                const { params, initialTrove, mockAssetAddress } = trove

                expect(params).to.deep.equal({
                    withdrawCollateral: initialTrove.collateral,
                    repayKUSD: initialTrove.netDebt
                });
                const finalTrove = await kumo.getTrove(mockAssetAddress);
                const assetValue = await assetTVL(finalTrove, mockAssetAddress)
                SystemTVL = SystemTVL.add(assetValue)
                expect(finalTrove.isEmpty).to.be.true;
            }
            expect(`${SystemTVL}`).to.equal("0")
        })
    })





    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Trove Multi Asset Independent tests ${mockAssetContract.name}`, () => {
            before(async () => {
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                kumo = await connectToDeployment(deployment, user);

                expect(kumo).to.be.an.instanceOf(EthersKumo);
            });


            afterEach(`Run after each test ${mockAssetContract.name}`, async () => {
                let totalCollateral = Decimal.ZERO
                let totalDebt = Decimal.ZERO
                let calculatedTVL = Decimal.ZERO
                const otherMockAssetContracts = mockAssetContracts.filter(contract => contract.name !== mockAssetContract.name)
                const currentTVL = (await kumo.getTrove(mockAssetAddress)).collateral.mul(await kumo.getPrice(mockAssetAddress))

                for await (const otherMockContract of otherMockAssetContracts) {
                    const mockAssetAddress = deployment.addresses[otherMockContract.contract];
                    const trove = await kumo.getTrove(mockAssetAddress)
                    totalCollateral = totalCollateral.add(trove.collateral)
                    totalDebt = totalDebt.add(trove.debt)
                    calculatedTVL = calculatedTVL.add((await kumo.getTrove(mockAssetAddress)).collateral.mul(await kumo.getPrice(mockAssetAddress)))
                    expect(trove.status).to.equal('nonExistent')
                }

                expect(`${currentTVL.mul(calculatedTVL)}`).to.equal("0")
                expect(`${totalCollateral}`).to.equal("0")
                expect(`${totalDebt}`).to.equal("0")
            })

            const withSomeBorrowing = { depositCollateral: 50, borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(100) };
            it(`should create independant trove with some borrowing ${mockAssetContract.name}`, async () => {
                const { newTrove, fee } = await kumo.openTrove(
                    withSomeBorrowing,
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing));
                expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(withSomeBorrowing.borrowKUSD)}`);
            });

            const repaySomeDebt = { repayKUSD: 10 };

            it(`should repay some debt ${mockAssetContract.name}`, async () => {
                const { newTrove, fee } = await kumo.repayKUSD(mockAssetAddress, repaySomeDebt.repayKUSD);
                expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing).adjust(repaySomeDebt));
                expect(`${fee}`).to.equal("0");
            });

            const borrowSomeMore = { borrowKUSD: 20 };

            it(`should borrow some more ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove, fee } = await kumo.borrowKUSD(mockAssetAddress, borrowSomeMore.borrowKUSD);
                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing).adjust(repaySomeDebt).adjust(borrowSomeMore)
                );
                expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowSomeMore.borrowKUSD)}`);
            });

            const depositMoreCollateral = { depositCollateral: 1 };

            it(`should deposit more collateral ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const { newTrove } = await kumo.depositCollateral(
                    mockAssetAddress,
                    depositMoreCollateral.depositCollateral
                );
                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing)
                        .adjust(repaySomeDebt)
                        .adjust(borrowSomeMore)
                        .adjust(depositMoreCollateral)
                );
            });

            const repayAndWithdraw = { repayKUSD: 60, withdrawCollateral: 0.5 };

            it(`should repay some debt and withdraw some collateral at the same time ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
                const {
                    rawReceipt,
                    details: { newTrove }
                } = await waitForSuccess(kumo.send.adjustTrove(repayAndWithdraw, mockAssetAddress));

                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing)
                        .adjust(repaySomeDebt)
                        .adjust(borrowSomeMore)
                        .adjust(depositMoreCollateral)
                        .adjust(repayAndWithdraw)
                );

                const asset1Balance = await mockContract.balanceOf(user.getAddress())
                const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(500).sub(451).add(0.5).hex);

                expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);
            });

            const borrowAndDeposit = { borrowKUSD: 60, depositCollateral: 0.5 };

            it(`should borrow more and deposit some collateral at the same time ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
                const {
                    rawReceipt,
                    details: { newTrove, fee }
                } = await waitForSuccess(kumo.send.adjustTrove(borrowAndDeposit, mockAssetAddress));

                expect(newTrove).to.deep.equal(
                    Trove.create(withSomeBorrowing)
                        .adjust(repaySomeDebt)
                        .adjust(borrowSomeMore)
                        .adjust(depositMoreCollateral)
                        .adjust(repayAndWithdraw)
                        .adjust(borrowAndDeposit)
                );

                expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowAndDeposit.borrowKUSD)}`);

                const asset1Balance = await mockContract.balanceOf(user.getAddress())
                const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(500).sub(451).add(0.5).sub(0.5).hex);

                expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);
            });

            it(`should close the Trove with some KUSD from another user ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const price = await kumo.getPrice(mockAssetAddress);
                const initialTrove = await kumo.getTrove(mockAssetAddress);
                const kusdBalance = await kumo.getKUMOBalance(mockAssetAddress);
                const kusdShortage = initialTrove.netDebt.sub(kusdBalance);

                let funderTrove = Trove.create({ depositCollateral: 1, borrowKUSD: kusdShortage });
                funderTrove = funderTrove.setDebt(Decimal.max(funderTrove.debt, KUSD_MINIMUM_DEBT));
                funderTrove = funderTrove.setCollateral(funderTrove.debt.mulDiv(1.51, price));

                const funderKumo = await connectToDeployment(deployment, funder);
                await funderKumo.openTrove(Trove.recreate(funderTrove), mockAssetAddress, undefined, {
                    gasLimit
                });
                await funderKumo.sendKUSD(await user.getAddress(), kusdShortage);

                const { params } = await kumo.closeTrove(mockAssetAddress);

                expect(params).to.deep.equal({
                    withdrawCollateral: initialTrove.collateral,
                    repayKUSD: initialTrove.netDebt
                });

                const finalTrove = await kumo.getTrove(mockAssetAddress);
                expect(finalTrove.isEmpty).to.be.true;
            });

        });
    })

});

