import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal,
    Decimalish,
    Trove,
    KumoReceipt,
    SuccessfulReceipt,
    SentKumoTransaction,
    TroveCreationParams
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

// // Test workarounds related to https://github.com/kumo/dev/issues/600
describe("EthersKumoHints", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let kumo: EthersKumo;

    let mockAssetAddress: string;

    const gasLimit = BigNumber.from(2500000);


    const openTroves = (users: Signer[], params: TroveCreationParams<Decimalish>[], mockAssetAddress1: string) =>
        params
            .map(
                (params, i) => () =>
                    Promise.all([
                        connectToDeployment(deployment, users[i]),
                        sendTo(users[i], 0.1).then(tx => tx.wait())
                    ]).then(async ([kumo]) => {
                        await kumo.openTrove(params, mockAssetAddress1, undefined, { gasLimit });
                    })
            )
            .reduce((a, b) => a.then(b), Promise.resolve());


    const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
        funder.sendTransaction({
            to: user.getAddress(),
            value: Decimal.from(value).add(GAS_BUDGET).hex,
            nonce
        });

   

    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Hints (adjustTrove) ${mockAssetContract.name}`, () => {
            let eightOtherUsers: Signer[];
            before(async function () {
                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                eightOtherUsers = otherUsers.slice(0, 8);
                kumo = await connectToDeployment(deployment, user);

                await openTroves(eightOtherUsers, [
                    { depositCollateral: 30, borrowKUSD: 2000 }, // 0
                    { depositCollateral: 30, borrowKUSD: 2100 }, // 1
                    { depositCollateral: 30, borrowKUSD: 2200 }, // 2
                    { depositCollateral: 30, borrowKUSD: 2300 }, // 3
                    // Test 1:           30,             2400
                    { depositCollateral: 30, borrowKUSD: 2500 }, // 4
                    { depositCollateral: 30, borrowKUSD: 2600 }, // 5
                    { depositCollateral: 30, borrowKUSD: 2700 }, // 6
                    { depositCollateral: 30, borrowKUSD: 2800 } //  7
                    // Test 2:           30,             2900
                    // Test 2 (other):   30,             3000
                    // Test 3:           30,             3100 -> 3200
                ], mockAssetAddress);
    
            });

            // it(`should not use extra gas when a Trove's position doesn't change ${mockAssetContract.name}`, async () => {

            // })

            // // // Always setup same initial balance for user
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

            // Test 1
            it(`should not use extra gas when a Trove's position doesn't change ${mockAssetContract.name}`, async () => {
                const { newTrove: initialTrove } = await kumo.openTrove(
                    {
                        depositCollateral: 30,
                        borrowKUSD: 2400
                    },
                    mockAssetAddress,

                    undefined,
                    { gasLimit }
                );

                // Maintain the same ICR / position in the list
                const targetTrove = initialTrove.multiply(1.1);

                const { rawReceipt } = await waitForSuccess(
                    kumo.send.adjustTrove(initialTrove.adjustTo(targetTrove), mockAssetAddress)
                );

                const gasUsed = rawReceipt.gasUsed.toNumber();
                // Higher gas usage due to asset parameter. ToDO: Estimate gas (25000 before asset)
                expect(gasUsed).to.be.at.most(310000);
            });

            // Test 2
            it(`should not traverse the whole list when bottom Trove moves ${mockAssetContract.name}`, async () => {
                const bottomKumo = await connectToDeployment(deployment, eightOtherUsers[7]);

                const initialTrove = await kumo.getTrove(mockAssetAddress);
                const bottomTrove = await bottomKumo.getTrove(mockAssetAddress);

                const targetTrove = Trove.create({ depositCollateral: 30, borrowKUSD: 2900 });
                const interferingTrove = Trove.create({ depositCollateral: 30, borrowKUSD: 3000 });

                const tx = await kumo.populate.adjustTrove(initialTrove.adjustTo(targetTrove), mockAssetAddress);

                // Suddenly: interference!
                await bottomKumo.adjustTrove(bottomTrove.adjustTo(interferingTrove), mockAssetAddress);

                const { rawReceipt } = await waitForSuccess(tx.send());

                const gasUsed = rawReceipt.gasUsed.toNumber();
                // Higher gas usage due to asset parameter. ToDO: Estimate gas (31000 before asset)
                expect(gasUsed).to.be.at.most(355000);
            });
            // Test 3
            it(`should not traverse the whole list when lowering ICR of bottom Trove ${mockAssetContract.name}`, async () => {
                const initialTrove = await kumo.getTrove(mockAssetAddress);

                const targetTrove = [
                    Trove.create({ depositCollateral: 30, borrowKUSD: 3100 }),
                    Trove.create({ depositCollateral: 30, borrowKUSD: 3200 })
                ];

                await kumo.adjustTrove(initialTrove.adjustTo(targetTrove[0]), mockAssetAddress);
                // Now we are the bottom Trove

                // Lower our ICR even more
                const { rawReceipt } = await waitForSuccess(
                    kumo.send.adjustTrove(targetTrove[0].adjustTo(targetTrove[1]), mockAssetAddress)
                );

                const gasUsed = rawReceipt.gasUsed.toNumber();
                // Higher gas usage due to asset parameter. ToDO: Estimate gas (24000 before asset)
                expect(gasUsed).to.be.at.most(270000);
            });

        });

    });
})