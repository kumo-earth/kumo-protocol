import { BlockTag } from "@ethersproject/abstract-provider";

import {
  CollateralGainTransferDetails,
  Decimal,
  Decimalish,
  FailedReceipt,
  Fees,
  LiquidationDetails,
  KumoStore,
  KUMOStake,
  RedemptionDetails,
  StabilityDeposit,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableKumo,
  TransactionFailedError,
  Trove,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams,
  TroveListingParams,
  TroveWithPendingRedistribution,
  UserTrove
} from "@kumodao/lib-base";

import {
  EthersKumoConnection,
  EthersKumoConnectionOptionalParams,
  EthersKumoStoreOption,
  _connect,
  _usingStore
} from "./EthersKumoConnection";

import {
  EthersCallOverrides,
  EthersProvider,
  EthersSigner,
  EthersTransactionOverrides,
  EthersTransactionReceipt
} from "./types";

import {
  BorrowingOperationOptionalParams,
  PopulatableEthersKumo,
  SentEthersKumoTransaction
} from "./PopulatableEthersKumo";
import { ReadableEthersKumo, ReadableEthersKumoWithStore } from "./ReadableEthersKumo";
import { SendableEthersKumo } from "./SendableEthersKumo";
import { BlockPolledKumoStore } from "./BlockPolledKumoStore";

/**
 * Thrown by {@link EthersKumo} in case of transaction failure.
 *
 * @public
 */
export class EthersTransactionFailedError extends TransactionFailedError<
  FailedReceipt<EthersTransactionReceipt>
> {
  constructor(message: string, failedReceipt: FailedReceipt<EthersTransactionReceipt>) {
    super("EthersTransactionFailedError", message, failedReceipt);
  }
}

const waitForSuccess = async <T>(tx: SentEthersKumoTransaction<T>) => {
  const receipt = await tx.waitForReceipt();

  if (receipt.status !== "succeeded") {
    throw new EthersTransactionFailedError("Transaction failed", receipt);
  }

  return receipt.details;
};

/**
 * Convenience class that combines multiple interfaces of the library in one object.
 *
 * @public
 */
export class EthersKumo implements ReadableEthersKumo, TransactableKumo {
  /** Information about the connection to the Kumo protocol. */
  readonly connection: EthersKumoConnection;

  /** Can be used to create populated (unsigned) transactions. */
  readonly populate: PopulatableEthersKumo;

  /** Can be used to send transactions without waiting for them to be mined. */
  readonly send: SendableEthersKumo;

  private _readable: ReadableEthersKumo;

  /** @internal */
  constructor(readable: ReadableEthersKumo) {
    this._readable = readable;
    this.connection = readable.connection;
    this.populate = new PopulatableEthersKumo(readable);
    this.send = new SendableEthersKumo(this.populate);
  }

  /** @internal */
  static _from(
    connection: EthersKumoConnection & { useStore: "blockPolled" }
  ): EthersKumoWithStore<BlockPolledKumoStore>;

  /** @internal */
  static _from(connection: EthersKumoConnection): EthersKumo;

  /** @internal */
  static _from(connection: EthersKumoConnection): EthersKumo {
    if (_usingStore(connection)) {
      return new _EthersKumoWithStore(ReadableEthersKumo._from(connection));
    } else {
      return new EthersKumo(ReadableEthersKumo._from(connection));
    }
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersKumoConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<EthersKumoWithStore<BlockPolledKumoStore>>;

  /**
   * Connect to the Kumo protocol and create an `EthersKumo` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersKumoConnectionOptionalParams
  ): Promise<EthersKumo>;

  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersKumoConnectionOptionalParams
  ): Promise<EthersKumo> {
    return EthersKumo._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `EthersKumo` is an {@link EthersKumoWithStore}.
   */
  hasStore(): this is EthersKumoWithStore;

  /**
   * Check whether this `EthersKumo` is an
   * {@link EthersKumoWithStore}\<{@link BlockPolledKumoStore}\>.
   */
  hasStore(store: "blockPolled"): this is EthersKumoWithStore<BlockPolledKumoStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotalRedistributed} */
  getTotalRedistributed(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable.getTotalRedistributed(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTroveBeforeRedistribution} */
  getTroveBeforeRedistribution(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    return this._readable.getTroveBeforeRedistribution(asset, address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTrove} */
  getTrove(asset: string, address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    return this._readable.getTrove(asset, address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getNumberOfTroves} */
  getNumberOfTroves(asset: string, overrides?: EthersCallOverrides): Promise<number> {
    return this._readable.getNumberOfTroves(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getPrice} */
  getPrice(asset: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getPrice(asset, overrides);
  }

  /** @internal */
  _getActivePool(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable._getActivePool(asset, overrides);
  }

  /** @internal */
  _getDefaultPool(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable._getDefaultPool(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotal} */
  getTotal(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable.getTotal(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getStabilityDeposit} */
  getStabilityDeposit(
    assetName: string,
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    return this._readable.getStabilityDeposit(assetName, address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getRemainingStabilityPoolKUMOReward} */
  getRemainingStabilityPoolKUMOReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingStabilityPoolKUMOReward(overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUSDInStabilityPool} */
  getKUSDInStabilityPool(asset: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getKUSDInStabilityPool(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUSDBalance} */
  getKUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getKUSDBalance(address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getBCTBalance} */
  getAssetBalance(
    address: string,
    assetType: string,
    provider: EthersProvider,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._readable.getAssetBalance(address, assetType, provider, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUMOBalance} */
  getKUMOBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getKUMOBalance(address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getUniTokenBalance} */
  getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getUniTokenBalance(address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getUniTokenAllowance} */
  getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getUniTokenAllowance(address, overrides);
  }

  /** @internal */
  _getRemainingLiquidityMiningKUMORewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    return this._readable._getRemainingLiquidityMiningKUMORewardCalculator(overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getRemainingLiquidityMiningKUMOReward} */
  getRemainingLiquidityMiningKUMOReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingLiquidityMiningKUMOReward(overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getLiquidityMiningStake} */
  getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getLiquidityMiningStake(address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotalStakedUniTokens} */
  getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedUniTokens(overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getLiquidityMiningKUMOReward} */
  getLiquidityMiningKUMOReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getLiquidityMiningKUMOReward(address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(
    asset: string,
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._readable.getCollateralSurplusBalance(asset, address, overrides);
  }

  /** @internal */
  getTroves(
    asset: string,
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.(getTroves:2)} */
  getTroves(
    asset: string,
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove[]>;

  getTroves(
    asset: string,
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove[]> {
    return this._readable.getTroves(asset, params, overrides);
  }

  /** @internal */
  _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return this._readable._getBlockTimestamp(blockTag);
  }

  /** @internal */
  _getFeesFactory(
    asset: string,
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._readable._getFeesFactory(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getFees} */
  getFees(asset: string, overrides?: EthersCallOverrides): Promise<Fees> {
    return this._readable.getFees(asset, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUMOStake} */
  getKUMOStake(asset: string, address: string, overrides?: EthersCallOverrides): Promise<KUMOStake> {
    return this._readable.getKUMOStake(asset, address, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotalStakedKUMO} */
  getTotalStakedKUMO(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedKUMO(overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTestTokensTransferState} */
  getTestTokensTransferState(
    assetAddress: string,
    userAddress: string,
    overrides?: EthersCallOverrides
  ): Promise<boolean> {
    return this._readable.getTestTokensTransferState(assetAddress, userAddress, overrides);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.openTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    asset: string,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveCreationDetails> {
    return this.send
      .openTrove(params, asset, maxBorrowingRateOrOptionalParams, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.closeTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  closeTrove(asset: string, overrides?: EthersTransactionOverrides): Promise<TroveClosureDetails> {
    return this.send.closeTrove(asset, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.adjustTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    asset: string,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send
      .adjustTrove(params, asset, maxBorrowingRateOrOptionalParams, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.depositCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  depositCollateral(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.depositCollateral(asset, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.withdrawCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawCollateral(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.withdrawCollateral(asset, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.borrowKUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  borrowKUSD(
    asset: string,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.borrowKUSD(asset, amount, maxBorrowingRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.repayKUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  repayKUSD(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.repayKUSD(asset, amount, overrides).then(waitForSuccess);
  }

  /** @internal */
  setPrice(asset: string, price: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.setPrice(asset, price, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.liquidate}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  liquidate(
    asset: string,
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send.liquidate(asset, address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.liquidateUpTo}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  liquidateUpTo(
    asset: string,
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send
      .liquidateUpTo(asset, maximumNumberOfTrovesToLiquidate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.depositKUSDInStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  depositKUSDInStabilityPool(
    amount: Decimalish,
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send.depositKUSDInStabilityPool(amount, asset, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.withdrawKUSDFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawKUSDFromStabilityPool(
    amount: Decimalish,
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send.withdrawKUSDFromStabilityPool(amount, asset, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.withdrawGainsFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawGainsFromStabilityPool(
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityPoolGainsWithdrawalDetails> {
    return this.send.withdrawGainsFromStabilityPool(asset, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.transferCollateralGainToTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  transferCollateralGainToTrove(
    asset: string,
    assetName: string,
    overrides?: EthersTransactionOverrides
  ): Promise<CollateralGainTransferDetails> {
    return this.send.transferCollateralGainToTrove(asset, assetName, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.sendKUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  sendKUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.sendKUSD(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.requestTestToken}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  requestTestToken(
    tokenAddress: string,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.requestTestToken(tokenAddress, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.transferTestTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  transferTestTokens(
    tokenAddress: string,
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.transferTestTokens(tokenAddress, toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.sendKUMO}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  sendKUMO(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.sendKUMO(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.redeemKUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  redeemKUSD(
    asset: string,
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<RedemptionDetails> {
    return this.send.redeemKUSD(asset, amount, maxRedemptionRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.claimCollateralSurplus}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  claimCollateralSurplus(asset: string, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.claimCollateralSurplus(asset, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.stakeKUMO}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  stakeKUMO(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeKUMO(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.unstakeKUMO}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  unstakeKUMO(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeKUMO(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.withdrawGainsFromStaking}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawGainsFromStaking(overrides).then(waitForSuccess);
  }


  /** @internal */
  _mintUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send._mintUniToken(amount, address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.approveUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  approveUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.approveUniTokens(allowance, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.stakeUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  stakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.unstakeUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  unstakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.withdrawKUMORewardFromLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawKUMORewardFromLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawKUMORewardFromLiquidityMining(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @kumodao/lib-base#TransactableKumo.exitLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  exitLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.exitLiquidityMining(overrides).then(waitForSuccess);
  }
}

/**
 * Variant of {@link EthersKumo} that exposes a {@link @kumodao/lib-base#KumoStore}.
 *
 * @public
 */
export interface EthersKumoWithStore<T extends KumoStore = KumoStore> extends EthersKumo {
  /** An object that implements KumoStore. */
  readonly store: T;
}

class _EthersKumoWithStore<T extends KumoStore = KumoStore>
  extends EthersKumo
  implements EthersKumoWithStore<T>
{
  readonly store: T;

  constructor(readable: ReadableEthersKumoWithStore<T>) {
    super(readable);

    this.store = readable.store;
  }

  hasStore(store?: EthersKumoStoreOption): boolean {
    return store === undefined || store === this.connection.useStore;
  }
}
