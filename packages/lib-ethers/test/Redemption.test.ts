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
    Fees,
    MAXIMUM_BORROWING_RATE
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

// Extra ETH sent to users to be spent on gas
const GAS_BUDGET = Decimal.from(0.1); // ETH


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


const waitForSuccess = async <T extends KumoReceipt>(
    tx: Promise<SentKumoTransaction<unknown, T>>
) => {
    const receipt = await (await tx).waitForReceipt();
    assertStrictEqual(receipt.status, "succeeded" as const);

    return receipt as Extract<T, SuccessfulReceipt>;
};

const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const


describe("EthersKumoRedemption", async () => {
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
        describe(`Redemption ${mockAssetContract.name}`, () => {
            const troveCreations = [
                { depositCollateral: 99, borrowKUSD: 4600 },
                { depositCollateral: 20, borrowKUSD: 2000 }, // net debt: 2010
                { depositCollateral: 20, borrowKUSD: 2100 }, // net debt: 2110.5
                { depositCollateral: 20, borrowKUSD: 2200 } //  net debt: 2211
            ];
            before(async function () {
                if (network.name !== "hardhat") {
                    // Redemptions are only allowed after a bootstrap phase of 2 weeks.
                    // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
                    this.skip();
                }

                // Deploy new instances of the contracts, for a clean slate
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                mockAsset = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
                 
                const otherUsersSubset = otherUsers.slice(0, 3);
                [deployerKumo, kumo, ...otherKumos] = await connectUsers([
                    deployer,
                    user,
                    ...otherUsersSubset
                ]);

                await sendToEach(otherUsersSubset, 0.1);
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
            it(`should fail to redeem during the bootstrap phase ${mockAssetContract.name}`, async () => {
                await kumo.openTrove(troveCreations[0], mockAssetAddress, undefined, { gasLimit });
                await otherKumos[0].openTrove(troveCreations[1], mockAssetAddress, undefined, {
                    gasLimit
                });
                await otherKumos[1].openTrove(troveCreations[2], mockAssetAddress, undefined, {
                    gasLimit
                });
                await otherKumos[2].openTrove(troveCreations[3], mockAssetAddress, undefined, {
                    gasLimit
                });

                await expect(kumo.redeemKUSD(mockAssetAddress, 4326.5)).to.eventually.be.rejected;
            });
            const someKUSD = Decimal.from(4326.5);
            it(`should redeem some KUSD after the bootstrap phase ${mockAssetContract.name}`, async () => {
                // Fast-forward 15 days
                await increaseTime(60 * 60 * 24 * 15);

                expect(`${await otherKumos[0].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");
                expect(`${await otherKumos[1].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");
                expect(`${await otherKumos[2].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");

                const expectedTotal = troveCreations
                    .map(params => Trove.create(params))
                    .reduce((a, b) => a.add(b));

                const total = await kumo.getTotal(mockAssetAddress);
                expect(total).to.deep.equal(expectedTotal);

                const expectedDetails = {
                    attemptedKUSDAmount: someKUSD,
                    actualKUSDAmount: someKUSD,
                    collateralTaken: someKUSD.div(200),
                    fee: new Fees(0, 0.99, 2, new Date(), new Date(), false)
                        .redemptionRate(someKUSD.div(total.debt))
                        .mul(someKUSD.div(200))
                };

                const { rawReceipt, details } = await waitForSuccess(kumo.send.redeemKUSD(mockAssetAddress, someKUSD));
                expect(details).to.deep.equal(expectedDetails);

                // const balance = Decimal.fromBigNumberString(`${await user.getBalance()}`);
                const asset1Balance = await mockAsset.balanceOf(user.getAddress())
                const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(99).add(expectedDetails.collateralTaken).sub(expectedDetails.fee).hex);
                expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);

                // BigNumber.from(STARTING_BALANCE.sub(50).sub(1).add(0.5).hex)

                expect(`${await kumo.getKUSDBalance()}`).to.equal("273.5");

                expect(`${(await otherKumos[0].getTrove(mockAssetAddress)).debt}`).to.equal(
                    `${Trove.create(troveCreations[1]).debt.sub(
                        someKUSD
                            .sub(Trove.create(troveCreations[2]).netDebt)
                            .sub(Trove.create(troveCreations[3]).netDebt)
                    )}`
                );

                expect((await otherKumos[1].getTrove(mockAssetAddress)).isEmpty).to.be.true;
                expect((await otherKumos[2].getTrove(mockAssetAddress)).isEmpty).to.be.true;
            });

            it(`should claim the collateral surplus after redemption ${mockAssetContract.name}`, async () => {
                const asset1balanceBefore1 = await mockAsset.balanceOf(otherUsers[1].getAddress())
                const asset1balanceBefore2 = await mockAsset.balanceOf(otherUsers[2].getAddress())

                expect(`${await otherKumos[0].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");

                const surplus1 = await otherKumos[1].getCollateralSurplusBalance(mockAssetAddress);
                const trove1 = Trove.create(troveCreations[2]);
                expect(`${surplus1}`).to.equal(`${trove1.collateral.sub(trove1.netDebt.div(200))}`);

                const surplus2 = await otherKumos[2].getCollateralSurplusBalance(mockAssetAddress);
                const trove2 = Trove.create(troveCreations[3]);
                expect(`${surplus2}`).to.equal(`${trove2.collateral.sub(trove2.netDebt.div(200))}`);

                const { rawReceipt: receipt1 } = await waitForSuccess(
                    otherKumos[1].send.claimCollateralSurplus(mockAssetAddress)
                );

                const { rawReceipt: receipt2 } = await waitForSuccess(
                    otherKumos[2].send.claimCollateralSurplus(mockAssetAddress)
                );

                expect(`${await otherKumos[0].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");
                expect(`${await otherKumos[1].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");
                expect(`${await otherKumos[2].getCollateralSurplusBalance(mockAssetAddress)}`).to.equal("0");

                const asset1balanceAfter1 = await mockAsset.balanceOf(otherUsers[1].getAddress())
                const asset1balanceAfter2 = await mockAsset.balanceOf(otherUsers[2].getAddress())

                expect(`${asset1balanceAfter1}`).to.equal(
                    `${asset1balanceBefore1.add(surplus1.hex)}`
                );

                expect(`${asset1balanceAfter2}`).to.equal(
                    `${asset1balanceBefore2.add(surplus2.hex)}`
                );
            });
            it(`borrowing rate should be maxed out now ${mockAssetContract.name}`, async () => {
                const borrowKUSD = Decimal.from(10);

                const { fee, newTrove } = await kumo.borrowKUSD(mockAssetAddress, borrowKUSD);
                expect(`${fee}`).to.equal(`${borrowKUSD.mul(MAXIMUM_BORROWING_RATE)}`);

                expect(newTrove).to.deep.equal(
                    Trove.create(troveCreations[0]).adjust({ borrowKUSD }, MAXIMUM_BORROWING_RATE)
                );
            });

        });
    })
});

