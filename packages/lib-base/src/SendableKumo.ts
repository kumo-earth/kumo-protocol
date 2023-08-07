import { Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableKumo,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableKumo";

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @kumodao/lib-ethers#SentEthersKumoTransaction}.
 *
 * @public
 */
export interface SentKumoTransaction<S = unknown, T extends KumoReceipt = KumoReceipt> {
  /** Implementation-specific sent transaction object. */
  readonly rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @remarks
   * Unlike {@link @kumodao/lib-base#SentKumoTransaction.waitForReceipt | waitForReceipt()},
   * this function doesn't wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link @kumodao/lib-base#FailedReceipt} or a
   *          {@link @kumodao/lib-base#SuccessfulReceipt}.
   */
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

/**
 * Indicates that the transaction hasn't been mined yet.
 *
 * @remarks
 * Returned by {@link SentKumoTransaction.getReceipt}.
 *
 * @public
 */
export type PendingReceipt = { status: "pending" };

/** @internal */
export const _pendingReceipt: PendingReceipt = { status: "pending" };

/**
 * Indicates that the transaction has been mined, but it failed.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * Returned by {@link SentKumoTransaction.getReceipt} and
 * {@link SentKumoTransaction.waitForReceipt}.
 *
 * @public
 */
export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

/** @internal */
export const _failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt
});

/**
 * Indicates that the transaction has succeeded.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * The `details` property may contain more information about the transaction.
 * See the return types of {@link TransactableKumo} functions for the exact contents of `details`
 * for each type of Kumo transaction.
 *
 * Returned by {@link SentKumoTransaction.getReceipt} and
 * {@link SentKumoTransaction.waitForReceipt}.
 *
 * @public
 */
export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

/** @internal */
export const _successfulReceipt = <R, D>(
  rawReceipt: R,
  details: D,
  toString?: () => string
): SuccessfulReceipt<R, D> => ({
  status: "succeeded",
  rawReceipt,
  details,
  ...(toString ? { toString } : {})
});

/**
 * Either a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MinedReceipt<R = unknown, D = unknown> = FailedReceipt<R> | SuccessfulReceipt<R, D>;

/**
 * One of either a {@link PendingReceipt}, a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type KumoReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

/** @internal */
export type _SendableFrom<T, R, S> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
  ? (...args: A) => Promise<SentKumoTransaction<S, KumoReceipt<R, D>>>
  : never;
};

/**
 * Send Kumo transactions.
 *
 * @remarks
 * The functions return an object implementing {@link SentKumoTransaction}, which can be used
 * to monitor the transaction and get its details when it succeeds.
 *
 * Implemented by {@link @kumodao/lib-ethers#SendableEthersKumo}.
 *
 * @public
 */
export interface SendableKumo<R = unknown, S = unknown>
  extends _SendableFrom<TransactableKumo, R, S> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableKumo.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    asset: string,
    maxBorrowingRate?: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveCreationDetails>>>;

  /** {@inheritDoc TransactableKumo.closeTrove} */
  closeTrove(asset: string): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveClosureDetails>>>;

  /** {@inheritDoc TransactableKumo.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    asset: string,
    maxBorrowingRate?: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableKumo.depositCollateral} */
  depositCollateral(
    asset: string,
    amount: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableKumo.withdrawCollateral} */
  withdrawCollateral(
    asset: string,
    amount: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableKumo.borrowKUSD} */
  borrowKUSD(
    asset: string,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableKumo.repayKUSD} */
  repayKUSD(
    asset: string,
    amount: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>;

  /** @internal */
  setPrice(
    asset: string,
    price: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.liquidate} */
  liquidate(
    asset: string,
    address: string | string[]
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableKumo.liquidateUpTo} */
  liquidateUpTo(
    asset: string,
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableKumo.depositKUSDInStabilityPool} */
  depositKUSDInStabilityPool(
    amount: Decimalish,
    asset: string,
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableKumo.withdrawKUSDFromStabilityPool} */
  withdrawKUSDFromStabilityPool(
    amount: Decimalish,
    asset: string
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableKumo.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(asset: string): Promise<
    SentKumoTransaction<S, KumoReceipt<R, StabilityPoolGainsWithdrawalDetails>>
  >;

  /** {@inheritDoc TransactableKumo.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(asset: string, assetName: string): Promise<
    SentKumoTransaction<S, KumoReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableKumo.sendKUSD} */
  sendKUSD(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.requestTestToken} */
  requestTestToken(_tokenAddress: string): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;


  /** {@inheritDoc TransactableKumo.transferTestTokens} */
  transferTestTokens(tokenAddress: string,
    toAddress: string,
    amount: Decimalish): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;


  /** {@inheritDoc TransactableKumo.sendKUMO} */
  sendKUMO(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.redeemKUSD} */
  redeemKUSD(
    asset: string,
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<SentKumoTransaction<S, KumoReceipt<R, RedemptionDetails>>>;

  /** {@inheritDoc TransactableKumo.claimCollateralSurplus} */
  claimCollateralSurplus(asset: string): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.stakeKUMO} */
  stakeKUMO(amount: Decimalish): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.unstakeKUMO} */
  unstakeKUMO(amount: Decimalish): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.approveUniTokens} */
  approveUniTokens(allowance?: Decimalish): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.stakeUniTokens} */
  stakeUniTokens(amount: Decimalish): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.unstakeUniTokens} */
  unstakeUniTokens(amount: Decimalish): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.withdrawKUMORewardFromLiquidityMining} */
  withdrawKUMORewardFromLiquidityMining(): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;

  /** {@inheritDoc TransactableKumo.exitLiquidityMining} */
  exitLiquidityMining(): Promise<SentKumoTransaction<S, KumoReceipt<R, void>>>;
}
