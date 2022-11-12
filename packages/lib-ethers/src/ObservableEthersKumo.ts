import { BigNumber } from "@ethersproject/bignumber";
import { Event } from "@ethersproject/contracts";

import {
  Decimal,
  ObservableKumo,
  StabilityDeposit,
  Trove,
  TroveWithPendingRedistribution
} from "@kumodao/lib-base";

import { _getContracts, _requireAddress } from "./EthersKumoConnection";
import { ReadableEthersKumo } from "./ReadableEthersKumo";

const debouncingDelayMs = 50;

const debounce = (listener: (latestBlock: number) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  let latestBlock = 0;

  return (...args: unknown[]) => {
    const event = args[args.length - 1] as Event;

    if (event.blockNumber !== undefined && event.blockNumber > latestBlock) {
      latestBlock = event.blockNumber;
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      listener(latestBlock);
      timeoutId = undefined;
    }, debouncingDelayMs);
  };
};

/** @alpha */
export class ObservableEthersKumo implements ObservableKumo {
  private readonly _readable: ReadableEthersKumo;
  private readonly _asset: string;

  constructor(readable: ReadableEthersKumo) {
    this._readable = readable;
    this._asset = "MCO2";
  }

  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void {
    const { activePool, defaultPool } = _getContracts(this._readable.connection);
    const assetSent = activePool.filters.AssetSent();

    const redistributionListener = debounce((blockTag: number) => {
      this._readable.getTotalRedistributed(this._asset, { blockTag }).then(onTotalRedistributedChanged);
    });

    const assetSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === defaultPool.address) {
        redistributionListener(event);
      }
    };

    activePool.on(assetSent, assetSentListener);

    return () => {
      activePool.removeListener(assetSent, assetSentListener);
    };
  }

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRedistribution) => void,
    address: string
  ): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { troveManager, borrowerOperations } = _getContracts(this._readable.connection);
    const troveUpdatedByTroveManager = troveManager.filters.TroveUpdated(address);
    const troveUpdatedByBorrowerOperations = borrowerOperations.filters.TroveUpdated(address);

    const troveListener = debounce((blockTag: number) => {
      this._readable.getTroveBeforeRedistribution(this._asset, address, { blockTag }).then(onTroveChanged);
    });

    troveManager.on(troveUpdatedByTroveManager, troveListener);
    borrowerOperations.on(troveUpdatedByBorrowerOperations, troveListener);

    return () => {
      troveManager.removeListener(troveUpdatedByTroveManager, troveListener);
      borrowerOperations.removeListener(troveUpdatedByBorrowerOperations, troveListener);
    };
  }

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void {
    const { troveManager } = _getContracts(this._readable.connection);
    const { TroveUpdated } = troveManager.filters;
    const troveUpdated = TroveUpdated();

    const troveUpdatedListener = debounce((blockTag: number) => {
      this._readable.getNumberOfTroves("MCO2", { blockTag }).then(onNumberOfTrovesChanged);
    });

    troveManager.on(troveUpdated, troveUpdatedListener);

    return () => {
      troveManager.removeListener(troveUpdated, troveUpdatedListener);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watchPrice(onPriceChanged: (price: Decimal) => void): () => void {
    // TODO revisit
    // We no longer have our own PriceUpdated events. If we want to implement this in an event-based
    // manner, we'll need to listen to aggregator events directly. Or we could do polling.
    throw new Error("Method not implemented.");
  }

  watchTotal(onTotalChanged: (total: Trove) => void): () => void {
    const { troveManager } = _getContracts(this._readable.connection);
    const { TroveUpdated } = troveManager.filters;
    const troveUpdated = TroveUpdated();

    const totalListener = debounce((blockTag: number) => {
      this._readable.getTotal(this._asset, { blockTag }).then(onTotalChanged);
    });

    troveManager.on(troveUpdated, totalListener);

    return () => {
      troveManager.removeListener(troveUpdated, totalListener);
    };
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address: string
  ): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { activePool, stabilityPool } = _getContracts(this._readable.connection);
    const { UserDepositChanged } = stabilityPool.filters;
    const { AssetSent } = activePool.filters;

    const userDepositChanged = UserDepositChanged(address);
    const assetSent = AssetSent();

    const depositListener = debounce((blockTag: number) => {
      this._readable.getStabilityDeposit(address, { blockTag }).then(onStabilityDepositChanged);
    });

    const assetSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === stabilityPool.address) {
        // Liquidation while Stability Pool has some deposits
        // There may be new gains
        depositListener(event);
      }
    };

    stabilityPool.on(userDepositChanged, depositListener);
    activePool.on(assetSent, assetSentListener);

    return () => {
      stabilityPool.removeListener(userDepositChanged, depositListener);
      activePool.removeListener(assetSent, assetSentListener);
    };
  }

  watchKUSDInStabilityPool(
    onKUSDInStabilityPoolChanged: (kusdInStabilityPool: Decimal) => void
  ): () => void {
    const { kusdToken, stabilityPool } = _getContracts(this._readable.connection);
    const { Transfer } = kusdToken.filters;

    const transferKUSDFromStabilityPool = Transfer(stabilityPool.address);
    const transferKUSDToStabilityPool = Transfer(null, stabilityPool.address);

    const stabilityPoolKUSDFilters = [transferKUSDFromStabilityPool, transferKUSDToStabilityPool];

    const stabilityPoolKUSDListener = debounce((blockTag: number) => {
      this._readable.getKUSDInStabilityPool({ blockTag }).then(onKUSDInStabilityPoolChanged);
    });

    stabilityPoolKUSDFilters.forEach(filter => kusdToken.on(filter, stabilityPoolKUSDListener));

    return () =>
      stabilityPoolKUSDFilters.forEach(filter =>
        kusdToken.removeListener(filter, stabilityPoolKUSDListener)
      );
  }

  watchKUSDBalance(onKUSDBalanceChanged: (balance: Decimal) => void, address: string): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { kusdToken } = _getContracts(this._readable.connection);
    const { Transfer } = kusdToken.filters;
    const transferKUSDFromUser = Transfer(address);
    const transferKUSDToUser = Transfer(null, address);

    const kusdTransferFilters = [transferKUSDFromUser, transferKUSDToUser];

    const kusdTransferListener = debounce((blockTag: number) => {
      this._readable.getKUSDBalance(address, { blockTag }).then(onKUSDBalanceChanged);
    });

    kusdTransferFilters.forEach(filter => kusdToken.on(filter, kusdTransferListener));

    return () =>
      kusdTransferFilters.forEach(filter => kusdToken.removeListener(filter, kusdTransferListener));
  }
}
