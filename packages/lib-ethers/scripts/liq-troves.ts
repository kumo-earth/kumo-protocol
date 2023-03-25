import WebSocket from "ws";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";
import { ethers, providers } from 'ethers';
import { NonceManager } from "@ethersproject/experimental";
import { red, blue, green, yellow, dim, bold } from "chalk";


var contractAbiFragment = [
    {
        "name": "transfer",
        "type": "function",
        "inputs": [
            {
                "name": "_to",
                "type": "address"
            },
            {
                "type": "uint256",
                "name": "_tokens"
            }
        ],
        "constant": false,
        "outputs": [],
        "payable": false
    }
];



import { Decimal, Trove, ASSET_TOKENS, Percent, KUSD_LIQUIDATION_RESERVE, UserTrove, TroveWithPendingRedistribution } from "@kumodao/lib-base";
import { EthersKumo, EthersKumoWithStore, BlockPolledKumoStore } from "@kumodao/lib-ethers";

import {
    Batched,
    BatchedProvider,
    WebSocketAugmented,
    WebSocketAugmentedProvider
} from "@kumodao/providers";


const BatchedWebSocketAugmentedJsonRpcProvider = Batched(WebSocketAugmented(JsonRpcProvider));

Object.assign(globalThis, { WebSocket });

const funderKey = "0x8b693607bd68c4deb7bcf976a473cf998bde9fbedf08e1d8adadacdff4e5d1b6";

let provider: BatchedProvider & WebSocketAugmentedProvider & JsonRpcProvider;
let funder: Wallet | NonceManager;
let kumo: EthersKumoWithStore<BlockPolledKumoStore>;
let liqKumo: EthersKumoWithStore<BlockPolledKumoStore>;
let liqManagedSig: NonceManager;
let stopStore: () => void;


const waitForSuccess = (tx: TransactionResponse) =>
    tx.wait().then(receipt => {
        if (!receipt.status) {
            throw new Error("Transaction failed");
        }
        return receipt;
    });

const troveWithMinCollRatio = async (assetPrice: Decimal): Promise<Decimal> => {
    return new Promise(resolve => setTimeout(resolve, 1000)).then(async () => {
        let initialValue = Decimal.from(150);
        let debt = Decimal.from(1800)
        while (initialValue.gt(Decimal.from(110))) {
            debt = debt.add(Decimal.from(100));
            const trove = new Trove(Decimal.from(3000), debt)
            const collateralRatio = trove.collateralRatio(Decimal.from(assetPrice))
            const collateralRatioPct = new Percent(collateralRatio);
            initialValue = Decimal.from(collateralRatioPct?.toString(0).substring(0, collateralRatioPct?.toString(0).length - 1))
        }
        return debt
    });
}

const transfrFunds = async (assetAddress: string, accountAddress: string) => {
    try {
        let mockERC20contract = new ethers.Contract(assetAddress, contractAbiFragment, funder);
        await mockERC20contract.transfer(accountAddress, Decimal.from(3000).hex).then(waitForSuccess);
    } catch (error) {
        console.log("transferFundsError------------------>", error)
    }
}

const createTrove = async (managedSigner: NonceManager, assetAddress: string, accountAddress: string, assetPrice: Decimal) => {
    try {
        await transfrFunds(assetAddress, accountAddress);
        const requiredDebtValue = await troveWithMinCollRatio(assetPrice)
        const populated = await kumo.populate
            .openTrove(
                Trove.recreate(new Trove(Decimal.from(3000), requiredDebtValue)),
                assetAddress,
                {},
                { from: accountAddress, nonce: await managedSigner.getTransactionCount() }
            )
        const signedTransaction = await managedSigner.signTransaction(populated.rawPopulatedTransaction)
        const transactionResponse = await provider.sendTransaction(signedTransaction)
        const receipt = await waitForSuccess(transactionResponse)
        return receipt
    } catch (error) {
        console.log("createTroveError--------------------------->", error)
    }
};

const setPrice = async (managedSigner: NonceManager, assetAddress: string, assetPrice: Decimal) => {
    try {
        const populated = await kumo.populate
            .setPrice(
                assetAddress,
                assetPrice,
                { nonce: await managedSigner.getTransactionCount() }
            )
        const signedTransaction = await managedSigner.signTransaction(populated.rawPopulatedTransaction)
        const transactionResponse = await provider.sendTransaction(signedTransaction)
        const receipt = await waitForSuccess(transactionResponse)
        return receipt
    } catch (error) {
        console.log("setPriceError--------------------------->", error)
    }

}



const runLoop = async () => {
    const keys = Object.keys(ASSET_TOKENS)
    const execute = async () => {
        for await (const key of keys) {
            try {
                const randomWallet = Wallet.createRandom().connect(provider);
                const managedSigner = new NonceManager(randomWallet);
                const { assetAddress } = ASSET_TOKENS[key]
                const accountAddress = await managedSigner.getAddress();
                const assetPriceBefore = await kumo.getPrice(assetAddress);
                const troveReceipt = await createTrove(managedSigner, assetAddress, accountAddress, assetPriceBefore)
                const assetPriceNewValue = assetPriceBefore.sub(1)
                const priceReceipt = await setPrice(managedSigner, assetAddress, assetPriceNewValue)
                if(troveReceipt?.status && priceReceipt?.status){
                    const receipt = await tryToLiquidate(managedSigner, assetAddress, assetPriceBefore.sub(1))
                    console.log("troveReceiptPriceReceiptLiqiudation", receipt?.status)
                }
            } catch (error) {
                console.log("liqLoopError--------------------------->", error)
            }

        }
    }
    execute().then(() => {
        console.log("liq loop ended -------------------------->")
    }).catch(error => {
        console.log('starting liq loop erro-------------------->', error)
    })
};

/**
 * @param {Decimal} [price]
 * @returns {(trove: UserTrove) => boolean}
 */
const underCollateralized = (price: Decimal): (trove: UserTrove) => boolean => trove => trove.collateralRatioIsBelowMinimum(price);

/**
 * @param {UserTrove}
 * @param {UserTrove}
 */
const byDescendingCollateral = ({ collateral: a }: UserTrove, { collateral: b }: UserTrove) =>
    b.gt(a) ? 1 : b.lt(a) ? -1 : 0;

function log(message: string) {
    console.log(`${dim(`[${new Date().toLocaleTimeString()}]`)} ${message}`);
}

const info = (message: string) => log(`${blue("ℹ")} ${message}`);
const warn = (message: string) => log(`${yellow("‼")} ${message}`);
const error = (message: string) => log(`${red("✖")} ${message}`);
const success = (message: string) => log(`${green("✔")} ${message}`);


/**
* @param {EthersKumoWithStore} [liquity]
*/
async function tryToLiquidate(managedSigner: NonceManager, assetAddress: string, assetPrice: Decimal) {
    try {
        info("Waiting for price drops...");
        const [gasPrice, riskiestTroves] = await Promise.all([
            liqKumo.connection.provider
                .getGasPrice()
                .then(bn => Decimal.fromBigNumberString(bn.toHexString())),

            liqKumo.getTroves(assetAddress,
                // sortedBy: "ascendingCollateralRatio"
                { first: 1, sortedBy: "ascendingCollateralRatio", beforeRedistribution: true }
                // overrides: { blockTag: 354 })
            )
        ]);

        const troves = riskiestTroves
            .filter(underCollateralized(assetPrice))
            .sort(byDescendingCollateral)
            .slice(0, 40);

        if (troves.length === 0) {
            // Nothing to liquidate
            console.log("Nothing to liquidate", troves.length)
            return;
        }


        const addresses = troves.map(trove => trove.ownerAddress);

        const liquidation = await liqKumo.populate.liquidate(assetAddress, addresses, { gasPrice: gasPrice.hex, nonce: await liqManagedSig.getTransactionCount()});
        const gasLimit = liquidation.rawPopulatedTransaction.gasLimit?.toNumber() || Decimal.ZERO;
        const expectedCost = gasPrice.mul(gasLimit).mul(assetPrice);

        const total = troves.reduce((a, b) => a.add(b) as TroveWithPendingRedistribution);
        const expectedCompensation = total.collateral
            .mul(0.005)
            .mul(assetPrice)
            .add(KUSD_LIQUIDATION_RESERVE.mul(troves.length));

        if (expectedCost.gt(expectedCompensation)) {
            // In reality, the TX cost will be lower than this thanks to storage refunds, but let's be
            // on the safe side.
            warn(
                "Skipping liquidation due to high TX cost " +
                `($${expectedCost.toString(2)} > $${expectedCompensation.toString(2)}).`
            );
            return;
        }

        info(`Attempting to liquidate ${troves.length} Trove(s)...`);


        const tx = await liquidation.send();
        const receipt = await tx.waitForReceipt();

        if (receipt.status === "failed") {
            error(`TX ${receipt.rawReceipt.transactionHash} failed.`);
            return;
        }

        const { collateralGasCompensation, kusdGasCompensation, liquidatedAddresses } = receipt.details;
        const gasCost = gasPrice.mul(receipt.rawReceipt.gasUsed.toNumber()).mul(assetPrice);
        const totalCompensation = collateralGasCompensation
            .mul(assetPrice)
            .add(kusdGasCompensation);

        success(
            `Received ${bold(`${collateralGasCompensation.toString(4)} ETH`)} + ` +
            `${bold(`${kusdGasCompensation.toString(2)} KUSD`)} compensation (` +
            (totalCompensation.gte(gasCost)
                ? `${green(`$${totalCompensation.sub(gasCost).toString(2)}`)} profit`
                : `${red(`$${gasCost.sub(totalCompensation).toString(2)}`)} loss`) +
            `) for liquidating ${liquidatedAddresses.length} Trove(s).`
        );
        await setPrice(managedSigner, assetAddress, assetPrice.add(1))
        return receipt
    } catch (err) {
        error("Unexpected error:");
        main()
    }
}




async function mainScript() {
    provider = new BatchedWebSocketAugmentedJsonRpcProvider();
    funder = new NonceManager(new Wallet(funderKey, provider));

    const network = await provider.getNetwork();

    provider.chainId = network.chainId;
    provider.openWebSocket(
        provider.connection.url.replace(/^http/i, "ws").replace("8545", "8546"),
        network
    );

    kumo = await EthersKumo.connect(provider, { useStore: "blockPolled" });



    kumo.store.onLoaded = () => {
        runLoop()

    };


    const liqProvider = new providers.JsonRpcProvider("http://localhost:8545");
    const liqRandomWallet = Wallet.createRandom().connect(liqProvider);
    liqManagedSig = new NonceManager(liqRandomWallet);
    const liqConnected = await EthersKumo.connect(liqManagedSig, { useStore: "blockPolled" });

    liqConnected.store.onLoaded = () => {
        liqKumo = liqConnected
    };

    liqConnected.store.start();
    stopStore = kumo.store.start();


};

const main = async () => {
    const interval = async () => {
        mainScript()
        setTimeout(interval, 60000 * 60 * 8);
    };
    interval();
};


main().catch(err => {
    console.error(err);
    // process.exit(1);
})
