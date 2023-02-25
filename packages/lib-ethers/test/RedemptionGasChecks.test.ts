import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Decimal,
    KUSD_LIQUIDATION_RESERVE,
    MINIMUM_BORROWING_RATE
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { connectToDeployment, connectUsers, increaseTime, sendToEach, setUpInitialUserBalance, waitForSuccess } from "../testUtils";
import { STARTING_BALANCE } from "../testUtils/constants";
import { mockAssetContracts } from "../testUtils/types";

chai.use(chaiAsPromised);
chai.use(chaiSpies);


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

                kumo = await connectToDeployment(deployment, user);
                expect(kumo).to.be.an.instanceOf(EthersKumo);
                
                const otherUsersSubset = otherUsers.slice(0, _redeemMaxIterations);
                expect(otherUsersSubset).to.have.length(_redeemMaxIterations);

                [deployerKumo, kumo, ...otherKumos] = await connectUsers(deployment, [
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);

                await deployerKumo.setPrice(mockAssetAddress, massivePrice);
                await sendToEach(otherUsersSubset, funder, 0.1);

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

                await setUpInitialUserBalance(user, funder, gasLimit);
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