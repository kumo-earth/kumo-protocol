import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal
} from "@kumodao/lib-base";


import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { connectToDeployment, connectUsers, sendToEach, setUpInitialUserBalance } from "../testUtils";
import { STARTING_BALANCE } from "../testUtils/constants";
import { mockAssetContracts } from "../testUtils/types";

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


// TODO make the testcases isolated
describe("EthersKumoOverStay", async () => {
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


    before(async () => {
        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
        deployment = await deployKumo(deployer);

        const otherUsersSubset = otherUsers.slice(0, 5);

        kumo = await connectToDeployment(deployment, user);
        expect(kumo).to.be.an.instanceOf(EthersKumo);

        [deployerKumo, kumo, ...otherKumos] = await connectUsers(deployment, [
            deployer,
            user,
            ...otherUsersSubset
        ]);
        await sendToEach(otherUsersSubset, funder, 0.1);
    })

    describe("OverStay Multi Asset Tests", () => {
        it(`should be call separated from before call`, async () => {
            for await (const mockAssetContract of mockAssetContracts) {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                // const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())

                let price = Decimal.from(200);
                await deployerKumo.setPrice(mockAssetAddress, price);

                // Use this account to print KUSD
                await kumo.openTrove(
                    { depositCollateral: 50, borrowKUSD: 5000 },
                    mockAssetAddress,

                    undefined,
                    { gasLimit }
                );

                // otherKumos[0-2] will be independent stability depositors
                await kumo.sendKUSD(await otherUsers[0].getAddress(), 3000);
                await kumo.sendKUSD(await otherUsers[1].getAddress(), 1000);
                await kumo.sendKUSD(await otherUsers[2].getAddress(), 1000);

                // otherKumos[3-4] will be Trove owners whose Troves get liquidated
                await otherKumos[3].openTrove(
                    { depositCollateral: 21, borrowKUSD: 2900 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                await otherKumos[4].openTrove(
                    { depositCollateral: 21, borrowKUSD: 2900 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );

                await otherKumos[0].depositKUSDInStabilityPool(3000, mockAssetContract.name);
                await otherKumos[1].depositKUSDInStabilityPool(1000, mockAssetContract.name);
                // otherKumos[2] doesn't deposit yet

                // Tank the price so we can liquidate
                price = Decimal.from(150);
                await deployerKumo.setPrice(mockAssetAddress, price);

                // Liquidate first victim
                await kumo.liquidate(mockAssetAddress, await otherUsers[3].getAddress());
                expect((await otherKumos[3].getTrove(mockAssetAddress)).isEmpty).to.be.true;

                // Now otherKumos[2] makes their deposit too
                await otherKumos[2].depositKUSDInStabilityPool(1000, mockAssetContract.name);

                // Liquidate second victim
                await kumo.liquidate(mockAssetAddress, await otherUsers[4].getAddress());
                expect((await otherKumos[4].getTrove(mockAssetAddress)).isEmpty).to.be.true;

            }

        })

        it(`should Stability Pool empty`, async () => {
            for await (const mockAssetContract of mockAssetContracts) {
                // Stability Pool is now empty
                expect(`${await kumo.getKUSDInStabilityPool(mockAssetContract.name)}`).to.equal("0");
            }
        })

        it(`should still be able to withdraw remaining deposit`, async () => {
            for await (const mockAssetContract of mockAssetContracts) {
                for await (const l of [otherKumos[0], otherKumos[1], otherKumos[2]]) {
                    const stabilityDeposit = await l.getStabilityDeposit(mockAssetContract.name);
                    await l.withdrawKUSDFromStabilityPool(stabilityDeposit.currentKUSD, mockAssetContract.name);
                }
            }
        })
    })



    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`when people overstay Multi Asset Independent tests ${mockAssetContract.name}`, () => {
            before(async () => {
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];

                const otherUsersSubset = otherUsers.slice(0, 5);

                kumo = await connectToDeployment(deployment, user);
                expect(kumo).to.be.an.instanceOf(EthersKumo);

                [deployerKumo, kumo, ...otherKumos] = await connectUsers(deployment, [
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);
                await sendToEach(otherUsersSubset, funder, 0.1);
            })

            // Always setup same initial balance for user
            beforeEach(async () => {
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
                expect(Number(currentAssetBalance.toString())).greaterThan(50)
            })

            it(`should be call separated from before call ${mockAssetContract.name}`, async () => {
                let price = Decimal.from(200);
                await deployerKumo.setPrice(mockAssetAddress, price);

                // Use this account to print KUSD
                await kumo.openTrove(
                    { depositCollateral: 50, borrowKUSD: 5000 },
                    mockAssetAddress,

                    undefined,
                    { gasLimit }
                );

                // otherKumos[0-2] will be independent stability depositors
                await kumo.sendKUSD(await otherUsers[0].getAddress(), 3000);
                await kumo.sendKUSD(await otherUsers[1].getAddress(), 1000);
                await kumo.sendKUSD(await otherUsers[2].getAddress(), 1000);

                // otherKumos[3-4] will be Trove owners whose Troves get liquidated
                await otherKumos[3].openTrove(
                    { depositCollateral: 21, borrowKUSD: 2900 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                await otherKumos[4].openTrove(
                    { depositCollateral: 21, borrowKUSD: 2900 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );

                await otherKumos[0].depositKUSDInStabilityPool(3000, mockAssetContract.name);
                await otherKumos[1].depositKUSDInStabilityPool(1000, mockAssetContract.name);
                // otherKumos[2] doesn't deposit yet

                // Tank the price so we can liquidate
                price = Decimal.from(150);
                await deployerKumo.setPrice(mockAssetAddress, price);

                // Liquidate first victim
                await kumo.liquidate(mockAssetAddress, await otherUsers[3].getAddress());
                expect((await otherKumos[3].getTrove(mockAssetAddress)).isEmpty).to.be.true;

                // Now otherKumos[2] makes their deposit too
                await otherKumos[2].depositKUSDInStabilityPool(1000, mockAssetContract.name);

                // Liquidate second victim
                await kumo.liquidate(mockAssetAddress, await otherUsers[4].getAddress());
                expect((await otherKumos[4].getTrove(mockAssetAddress)).isEmpty).to.be.true;

                // Stability Pool is now empty
                expect(`${await kumo.getKUSDInStabilityPool(mockAssetContract.name)}`).to.equal("0");
            })

            it(`should still be able to withdraw remaining deposit ${mockAssetContract.name}`, async () => {
                for (const l of [otherKumos[0], otherKumos[1], otherKumos[2]]) {
                    const stabilityDeposit = await l.getStabilityDeposit(mockAssetContract.name);
                    await l.withdrawKUSDFromStabilityPool(stabilityDeposit.currentKUSD, mockAssetContract.name);
                }
            });
        })
    });
});
