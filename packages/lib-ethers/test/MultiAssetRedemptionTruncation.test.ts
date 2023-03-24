import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Decimal,
    Trove,
    KUSD_MINIMUM_NET_DEBT
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { connectToDeployment, connectUsers, increaseTime, sendToEach, setUpInitialUserBalance, waitForSuccess } from "../testUtils";
import { mockAssetContracts } from "../testUtils/types";
import { STARTING_BALANCE } from "../testUtils/constants";


const ERC20ABI = require("../abi/ERC20Test.json")

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


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
        describe(`Redemption truncation Multi Asset Independent tests ${mockAssetContract.name}`, () => {
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

                kumo = await connectToDeployment(deployment, user);
                expect(kumo).to.be.an.instanceOf(EthersKumo);

                [deployerKumo, kumo, ...otherKumos] = await connectUsers(deployment, [
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);
                await sendToEach(otherUsersSubset, funder, 0.1);

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

                await setUpInitialUserBalance(user, funder, gasLimit);
                expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
            });

            afterEach(`Run after each test ${mockAssetContract.name}`, async () => {
                const otherMockAssetContracts = mockAssetContracts.filter(contract => contract.name !== mockAssetContract.name)
                const currentAssetBalance = await kumo.getAssetBalance(await user.getAddress(), mockAssetAddress, provider)
                for await (const otherMockContract of otherMockAssetContracts) {
                    const mockAssetAddress = deployment.addresses[otherMockContract.contract];
                    const assetBalance = await kumo.getAssetBalance(await user.getAddress(), mockAssetAddress, provider)
                    expect(`${assetBalance}`).to.equal("100")
                }
                expect(Number(currentAssetBalance.toString())).lessThan(20)
            })

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

