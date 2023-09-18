import { Decimal, Decimalish, KumoReceipt, SentKumoTransaction, SuccessfulReceipt, TroveCreationParams } from "@kumodao/lib-base";
import { assert } from "chai";
import { BigNumber, Signer } from "ethers/lib/ethers";
import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { ethers } from "hardhat";
import { GAS_BUDGET, STARTING_BALANCE } from "./constants";


const provider = ethers.provider;

export function assertStrictEqual<T, U extends T>(
    actual: T,
    expected: U,
    message?: string
): asserts actual is U {
    assert.strictEqual(actual, expected, message);
}
export function assertDefined<T>(actual: T | undefined): asserts actual is T {
    assert(actual !== undefined);
}

export const increaseTime = async (timeJumpSeconds: number) => {
    await provider.send("evm_increaseTime", [timeJumpSeconds]);
};

export const connectToDeployment = async (
    deployment: _KumoDeploymentJSON,
    signer: Signer
) =>
    EthersKumo._from(
        _connectToDeployment(deployment, signer, {
            userAddress: await signer.getAddress()
        })
    );

export const waitForSuccess = async <T extends KumoReceipt>(
    tx: Promise<SentKumoTransaction<unknown, T>>
) => {
    const receipt = await (await tx).waitForReceipt();
    assertStrictEqual(receipt.status, "succeeded" as const);

    return receipt as Extract<T, SuccessfulReceipt>;
};

export const connectUsers = (deployment: _KumoDeploymentJSON, users: Signer[]) =>
    Promise.all(users.map(user => connectToDeployment(deployment, user)));

export const sendTo = (user: Signer, funder: Signer, value: Decimalish, nonce?: number) =>
    funder.sendTransaction({
        to: user.getAddress(),
        value: Decimal.from(value).add(GAS_BUDGET).hex,
        nonce
    });

export const sendToEach = async (users: Signer[], funder: Signer, value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());
    const txs = await Promise.all(users.map((user, i) => sendTo(user, funder, value, txCount + i)));

    // Wait for the last tx to be mined.
    await txs[txs.length - 1].wait();
};


export const setUpInitialUserBalance =  async (user: Signer, funder: Signer, gasLimit:BigNumber) => {
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
}

export const openTroves = (deployment: _KumoDeploymentJSON, users: Signer[], funder: Signer, params: TroveCreationParams<Decimalish>[], mockAssetAddress: string, gasLimit: BigNumber) =>
    params
        .map(
            (params, i) => () =>
                Promise.all([
                    connectToDeployment(deployment, users[i]),
                    sendTo(users[i], funder, 0.1).then(tx => tx.wait())
                ]).then(async ([kumo]) => {
                    await kumo.openTrove(params, mockAssetAddress, undefined, { gasLimit });
                })
        )
        .reduce((a, b) => a.then(b), Promise.resolve());

