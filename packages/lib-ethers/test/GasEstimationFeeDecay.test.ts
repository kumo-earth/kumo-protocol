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
    TroveCreationParams,
    KUSD_MINIMUM_NET_DEBT,
    KUSD_LIQUIDATION_RESERVE
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


describe("EthersKumoGasEstimationFeeDecay", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let kumo: EthersKumo;
    let otherKumos: EthersKumo[];


    let mockAssetAddress: string;

    const gasLimit = BigNumber.from(2500000);



    const connectUsers = (users: Signer[]) =>
        Promise.all(users.map(user => connectToDeployment(deployment, user)));

    const openTroves = (users: Signer[], params: TroveCreationParams<Decimalish>[], mockAssetAddress: string) =>
        params
            .map(
                (params, i) => () =>
                    Promise.all([
                        connectToDeployment(deployment, users[i]),
                        sendTo(users[i], 0.1).then(tx => tx.wait())
                    ]).then(async ([kumo]) => {
                        await kumo.openTrove(params, mockAssetAddress, undefined, { gasLimit });
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
        describe(`Gas estimation fee decay ${mockAssetContract.name}`, () => {
            before(async function () {
                if (network.name !== "hardhat") {
                    this.skip();
                }
                this.timeout("1m");

                [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
                deployment = await deployKumo(deployer);
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];

                const [redeemedUser, ...someMoreUsers] = otherUsers.slice(0, 21);
                [kumo, ...otherKumos] = await connectUsers([user, ...someMoreUsers]);

                // Create a "slope" of Troves with similar, but slightly decreasing ICRs
                await openTroves(
                    someMoreUsers,
                    someMoreUsers.map((_, i) => ({
                        depositCollateral: 20,
                        borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(i / 10)
                    })), mockAssetAddress
                );
                // Sweep KUSD
                await Promise.all(
                    otherKumos.map(async otherKumo =>
                        otherKumo.sendKUSD(await user.getAddress(), await otherKumo.getKUSDBalance())
                    )
                );

                const price = await kumo.getPrice(mockAssetAddress);

                // Create a "designated victim" Trove that'll be redeemed
                const redeemedTroveDebt = await kumo
                    .getKUSDBalance()
                    .then(x => x.div(10).add(KUSD_LIQUIDATION_RESERVE));
                const redeemedTroveCollateral = redeemedTroveDebt.mulDiv(1.1, price);
                const redeemedTrove = new Trove(redeemedTroveCollateral, redeemedTroveDebt);

                await openTroves([redeemedUser], [Trove.recreate(redeemedTrove)], mockAssetAddress);

                // Jump past bootstrap period
                await increaseTime(60 * 60 * 24 * 15);

                // Increase the borrowing rate by redeeming
                const { actualKUSDAmount } = await kumo.redeemKUSD(mockAssetAddress, redeemedTrove.netDebt);

                expect(`${actualKUSDAmount}`).to.equal(`${redeemedTrove.netDebt}`);

                const borrowingRate = await kumo.getFees(mockAssetAddress).then(fees => Number(fees.borrowingRate()));
                expect(borrowingRate).to.be.within(0.04, 0.049); // make sure it's high, but not clamped to 5%

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

