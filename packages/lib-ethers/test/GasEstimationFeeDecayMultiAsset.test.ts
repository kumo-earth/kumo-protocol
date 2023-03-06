import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Trove,
    KUSD_MINIMUM_NET_DEBT,
    Decimal
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { connectToDeployment, connectUsers, increaseTime, openTroves, setUpInitialUserBalance, waitForSuccess } from "../testUtils";
import { mockAssetContracts } from "../testUtils/types";
import { STARTING_BALANCE } from "../testUtils/constants";

chai.use(chaiAsPromised);
chai.use(chaiSpies);


describe("EthersKumoGasEstimationFeeDecayMultiAsset", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];
    let deployment: _KumoDeploymentJSON;

    let kumo: EthersKumo;
    let otherKumos: EthersKumo[];
    let redeemedUser: Signer
    let someMoreUsers: Signer[]

    let mockAssetAddress: string;
    
    const gasLimit = BigNumber.from(2500000);


    before(async function () {
        if (network.name !== "hardhat") {
            this.skip();
        }
        this.timeout("1m");

        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
        deployment = await deployKumo(deployer);
        kumo = await connectToDeployment(deployment, user);
        expect(kumo).to.be.an.instanceOf(EthersKumo);

        [redeemedUser, ...someMoreUsers] = otherUsers.slice(0, 21);
        [kumo, ...otherKumos] = await connectUsers(deployment, [user, ...someMoreUsers]);
    })


    mockAssetContracts.forEach(async (mockAssetContract, index) => {
        describe(`Gas estimation fee decay Multi Asset ${mockAssetContract.name}`, () => {
            before(async function () {
                this.timeout("1m");

                // Create a "slope" of Troves with similar, but slightly decreasing ICRs
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
              
                await openTroves(
                    deployment,
                    someMoreUsers,
                    funder,
                    someMoreUsers.map((_, i) => ({
                        depositCollateral: 20,
                        borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(i / 10)
                    })), mockAssetAddress, gasLimit
                );
                // Sweep KUSD
                if (index < 1) {
                    await Promise.all(
                        otherKumos.map(async otherKumo =>
                            otherKumo.sendKUSD(await user.getAddress(), await otherKumo.getKUSDBalance())
                        )
                    );
                }

                const redeemedTrove = new Trove(Decimal.from(20.91045), Decimal.from(3801.9));
                await openTroves(deployment, [redeemedUser], funder, [Trove.recreate(redeemedTrove)], mockAssetAddress, gasLimit);
                // Jump past bootstrap period
                // if (index < 1) {
                await increaseTime(60 * 60 * 24 * 15);
                // }
                // Increase the borrowing rate by redeeming
                const { actualKUSDAmount } = await kumo.redeemKUSD(mockAssetAddress, redeemedTrove.netDebt, undefined, { gasLimit });

                expect(`${actualKUSDAmount}`).to.equal(`${redeemedTrove.netDebt}`);

                const borrowingRate = await kumo.getFees(mockAssetAddress).then(fees => Number(fees.borrowingRate()));
                expect(borrowingRate).to.be.within(0.04, 0.049); // make sure it's high, but not clamped to 5%
            });

            // Always setup same initial balance for user
            beforeEach(async () => {
                const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

                await setUpInitialUserBalance(user, funder, gasLimit)
                expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
            });


            it(`should predict the gas increase due to fee decay ${mockAssetContract.name}`, async function () {
                this.timeout("1m");

                const [bottomTrove] = await kumo.getTroves(mockAssetAddress, {
                    first: 1,
                    sortedBy: "ascendingCollateralRatio"
                });

                const borrowingRate = await kumo.getFees(mockAssetAddress).then(fees => fees.borrowingRate());

                for (const [borrowingFeeDecayToleranceMinutes, roughGasHeadroom] of [
                    [10, 133000],
                    [20, 251000],
                    [30, 335000]
                ]) {
                    const tx = await kumo.populate.openTrove(
                        Trove.recreate(bottomTrove, borrowingRate),
                        mockAssetAddress,
                        {
                            borrowingFeeDecayToleranceMinutes
                        }
                    );
                    expect(tx.gasHeadroom).to.be.within(roughGasHeadroom - 1000, roughGasHeadroom + 1000);
                }
            });

            it(`should include enough gas for the TX to succeed after pending ${mockAssetContract.name}`, async function () {
                this.timeout("1m");

                const [bottomTrove] = await kumo.getTroves(mockAssetAddress, {
                    first: 1,
                    sortedBy: "ascendingCollateralRatio"
                });

                const borrowingRate = await kumo.getFees(mockAssetAddress).then(fees => fees.borrowingRate());

                const tx = await kumo.populate.openTrove(
                    Trove.recreate(bottomTrove.multiply(2), borrowingRate),
                    mockAssetAddress,
                    { borrowingFeeDecayToleranceMinutes: 60 },
                    { gasLimit }
                );

                await increaseTime(60 * 60);
                await waitForSuccess(tx.send());
            });
        });
    })
});

