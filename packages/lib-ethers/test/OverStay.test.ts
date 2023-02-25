import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal,
    Decimalish
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



const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const


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



    const connectUsers = (users: Signer[]) =>
        Promise.all(users.map(user => connectToDeployment(deployment, user)));


    const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
        funder.sendTransaction({
            to: user.getAddress(),
            value: Decimal.from(value).add(GAS_BUDGET).hex,
            nonce
        });

    const sendToEach = async (users: Signer[], value: Decimalish) => {
        const txCount = await provider.getTransactionCount(funder.getAddress());
        const txs = await Promise.all(users.map((user, i) => sendTo(user, value, txCount + i)));

        // Wait for the last tx to be mined.
        await txs[txs.length - 1].wait();
    };


    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`when people overstay ${mockAssetContract.name}`, () => {
            before(async () => {
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const otherUsersSubset = otherUsers.slice(0, 5);
                [deployerKumo, kumo, ...otherKumos] = await connectUsers([
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);

                await sendToEach(otherUsersSubset, 0.1);

            })
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

