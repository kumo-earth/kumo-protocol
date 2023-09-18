import { Decimal, Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";
import { KumoReceipt, SendableKumo, SentKumoTransaction } from "./SendableKumo";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableKumo";

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Implemented by {@link @kumodao/lib-ethers#PopulatedEthersKumoTransaction}.
 *
 * @public
 */
export interface PopulatedKumoTransaction<
  P = unknown,
  T extends SentKumoTransaction = SentKumoTransaction
> {
  /** Implementation-specific populated transaction object. */
  readonly rawPopulatedTransaction: P;

  /**
   * Send the transaction.
   *
   * @returns An object that implements {@link @kumodao/lib-base#SentKumoTransaction}.
   */
  send(): Promise<T>;
}

/**
 * A redemption transaction that has been prepared for sending.
 *
 * @remarks
 * The Kumo protocol fulfills redemptions by repaying the debt of Troves in ascending order of
 * their collateralization ratio, and taking a portion of their collateral in exchange. Due to the
 * {@link @kumodao/lib-base#KUSD_MINIMUM_DEBT | minimum debt} requirement that Troves must fulfill,
 * some KUSD amounts are not possible to redeem exactly.
 *
 * When {@link @kumodao/lib-base#PopulatableKumo.redeemKUSD | redeemKUSD()} is called with an
 * amount that can't be fully redeemed, the amount will be truncated (see the `redeemableKUSDAmount`
 * property). When this happens, the redeemer can either redeem the truncated amount by sending the
 * transaction unchanged, or prepare a new transaction by
 * {@link @kumodao/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt | increasing the amount}
 * to the next lowest possible value, which is the sum of the truncated amount and
 * {@link @kumodao/lib-base#KUSD_MINIMUM_NET_DEBT}.
 *
 * @public
 */
export interface PopulatedRedemption<P = unknown, S = unknown, R = unknown>
  extends PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, RedemptionDetails>>> {
  /** Amount of KUSD the redeemer is trying to redeem. */
  readonly attemptedKUSDAmount: Decimal;

  /** Maximum amount of KUSD that is currently redeemable from `attemptedKUSDAmount`. */
  readonly redeemableKUSDAmount: Decimal;

  /** Whether `redeemableKUSDAmount` is less than `attemptedKUSDAmount`. */
  readonly isTruncated: boolean;

  /**
   * Prepare a new transaction by increasing the attempted amount to the next lowest redeemable
   * value.
   *
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @kumodao/lib-base#Fees.redemptionRate | redemption rate} to
   *                            use in the new transaction.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the original transaction's `maxRedemptionRate` is reused
   * unless that was also omitted, in which case the current redemption rate (based on the increased
   * amount) plus 0.1% is used as maximum acceptable rate.
   */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;
}

/** @internal */
export type _PopulatableFrom<T, P> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer U>
  ? U extends SentKumoTransaction
  ? (...args: A) => Promise<PopulatedKumoTransaction<P, U>>
  : never
  : never;
};

/**
 * Prepare Kumo transactions for sending.
 *
 * @remarks
 * The functions return an object implementing {@link PopulatedKumoTransaction}, which can be
 * used to send the transaction and get a {@link SentKumoTransaction}.
 *
 * Implemented by {@link @kumodao/lib-ethers#PopulatableEthersKumo}.
 *
 * @public
 */
export interface PopulatableKumo<R = unknown, S = unknown, P = unknown>
  extends _PopulatableFrom<SendableKumo<R, S>, P> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableKumo.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    asset: string,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveCreationDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.closeTrove} */
  closeTrove(
    asset: string
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveClosureDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    asset: string,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.depositCollateral} */
  depositCollateral(
    asset: string,
    amount: Decimalish
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.withdrawCollateral} */
  withdrawCollateral(
    asset: string,
    amount: Decimalish
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.borrowKUSD} */
  borrowKUSD(
    asset: string,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.repayKUSD} */
  repayKUSD(
    asset: string,
    amount: Decimalish
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveAdjustmentDetails>>>
  >;

  /** @internal */
  setPrice(
    asset: string,
    price: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.liquidate} */
  liquidate(
    asset: string,
    address: string | string[]
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.liquidateUpTo} */
  liquidateUpTo(
    asset: string,
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableKumo.depositKUSDInStabilityPool} */
  depositKUSDInStabilityPool(
    amount: Decimalish,
    asset: string
  ): Promise<
    PopulatedKumoTransaction<
      P,
      SentKumoTransaction<S, KumoReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableKumo.withdrawKUSDFromStabilityPool} */
  withdrawKUSDFromStabilityPool(
    amount: Decimalish,
    asset: string
  ): Promise<
    PopulatedKumoTransaction<
      P,
      SentKumoTransaction<S, KumoReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableKumo.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(asset: string): Promise<
    PopulatedKumoTransaction<
      P,
      SentKumoTransaction<S, KumoReceipt<R, StabilityPoolGainsWithdrawalDetails>>
    >
  >;

  /** {@inheritDoc TransactableKumo.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(asset: string, assetName: string): Promise<
    PopulatedKumoTransaction<
      P,
      SentKumoTransaction<S, KumoReceipt<R, CollateralGainTransferDetails>>
    >
  >;

  /** {@inheritDoc TransactableKumo.sendKUSD} */
  sendKUSD(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.requestTestToken} */
  requestTestToken(
    tokenAddress: string
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.transferTestTokens} */
  transferTestTokens(
    tokenAddress: string,
    toAddress : string,
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.sendKUMO} */
  sendKUMO(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.redeemKUSD} */
  redeemKUSD(
    asset: string,
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;

  /** {@inheritDoc TransactableKumo.claimCollateralSurplus} */
  claimCollateralSurplus(
    asset: string
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.stakeKUMO} */
  stakeKUMO(
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.unstakeKUMO} */
  unstakeKUMO(
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableKumo.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.stakeUniTokens} */
  stakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.unstakeUniTokens} */
  unstakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;

  /** {@inheritDoc TransactableKumo.withdrawKUMORewardFromLiquidityMining} */
  withdrawKUMORewardFromLiquidityMining(): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableKumo.exitLiquidityMining} */
  exitLiquidityMining(): Promise<
    PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>
  >;
}
