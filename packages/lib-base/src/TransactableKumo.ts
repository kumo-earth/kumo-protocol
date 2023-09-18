import { Decimal, Decimalish } from "./Decimal";
import { Trove, TroveAdjustmentParams, TroveClosureParams, TroveCreationParams } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";
import { FailedReceipt } from "./SendableKumo";

/**
 * Thrown by {@link TransactableKumo} functions in case of transaction failure.
 *
 * @public
 */
export class TransactionFailedError<T extends FailedReceipt = FailedReceipt> extends Error {
  readonly failedReceipt: T;

  /** @internal */
  constructor(name: string, message: string, failedReceipt: T) {
    super(message);
    this.name = name;
    this.failedReceipt = failedReceipt;
  }
}

/**
 * Details of an {@link TransactableKumo.openTrove | openTrove()} transaction.
 *
 * @public
 */
export interface TroveCreationDetails {
  /** How much was deposited and borrowed. */
  params: TroveCreationParams<Decimal>;

  /** The Trove that was created by the transaction. */
  newTrove: Trove;

  /** Amount of KUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of an {@link TransactableKumo.adjustTrove | adjustTrove()} transaction.
 *
 * @public
 */
export interface TroveAdjustmentDetails {
  /** Parameters of the adjustment. */
  params: TroveAdjustmentParams<Decimal>;

  /** New state of the adjusted Trove directly after the transaction. */
  newTrove: Trove;

  /** Amount of KUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of a {@link TransactableKumo.closeTrove | closeTrove()} transaction.
 *
 * @public
 */
export interface TroveClosureDetails {
  /** How much was withdrawn and repaid. */
  params: TroveClosureParams<Decimal>;
}

/**
 * Details of a {@link TransactableKumo.liquidate | liquidate()} or
 * {@link TransactableKumo.liquidateUpTo | liquidateUpTo()} transaction.
 *
 * @public
 */
export interface LiquidationDetails {
  /** Addresses whose Troves were liquidated by the transaction. */
  liquidatedAddresses: string[];

  /** Total collateral liquidated and debt cleared by the transaction. */
  totalLiquidated: Trove;

  /** Amount of KUSD paid to the liquidator as gas compensation. */
  kusdGasCompensation: Decimal;

  /** Amount of native currency (e.g. Ether) paid to the liquidator as gas compensation. */
  collateralGasCompensation: Decimal;
}

/**
 * Details of a {@link TransactableKumo.redeemKUSD | redeemKUSD()} transaction.
 *
 * @public
 */
export interface RedemptionDetails {
  /** Amount of KUSD the redeemer tried to redeem. */
  attemptedKUSDAmount: Decimal;

  /**
   * Amount of KUSD that was actually redeemed by the transaction.
   *
   * @remarks
   * This can end up being lower than `attemptedKUSDAmount` due to interference from another
   * transaction that modifies the list of Troves.
   *
   * @public
   */
  actualKUSDAmount: Decimal;

  /** Amount of collateral (e.g. Ether) taken from Troves by the transaction. */
  collateralTaken: Decimal;

  /** Amount of native currency (e.g. Ether) deducted as fee from collateral taken. */
  fee: Decimal;
}

/**
 * Details of a
 * {@link TransactableKumo.withdrawGainsFromStabilityPool | withdrawGainsFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityPoolGainsWithdrawalDetails {
  /** Amount of KUSD burned from the deposit by liquidations since the last modification. */
  kusdLoss: Decimal;

  /** Amount of KUSD in the deposit directly after this transaction. */
  newKUSDDeposit: Decimal;

  /** Amount of native currency (e.g. Ether) paid out to the depositor in this transaction. */
  collateralGain: Decimal;

  /** Amount of KUMO rewarded to the depositor in this transaction. */
  kumoReward: Decimal;
}

/**
 * Details of a
 * {@link TransactableKumo.depositKUSDInStabilityPool | depositKUSDInStabilityPool()} or
 * {@link TransactableKumo.withdrawKUSDFromStabilityPool | withdrawKUSDFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails {
  /** Change that was made to the deposit by this transaction. */
  change: StabilityDepositChange<Decimal>;
}

/**
 * Details of a
 * {@link TransactableKumo.transferCollateralGainToTrove | transferCollateralGainToTrove()}
 * transaction.
 *
 * @public
 */
export interface CollateralGainTransferDetails extends StabilityPoolGainsWithdrawalDetails {
  /** New state of the depositor's Trove directly after the transaction. */
  newTrove: Trove;
}

/**
 * Send Kumo transactions and wait for them to succeed.
 *
 * @remarks
 * The functions return the details of the transaction (if any), or throw an implementation-specific
 * subclass of {@link TransactionFailedError} in case of transaction failure.
 *
 * Implemented by {@link @kumodao/lib-ethers#EthersKumo}.
 *
 * @public
 */
export interface TransactableKumo {
  /**
   * Open a new Trove by depositing collateral and borrowing KUSD.
   *
   * @param params - How much to deposit and borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @kumodao/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    asset: string,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveCreationDetails>;

  /**
   * Close existing Trove by repaying all debt and withdrawing all collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  closeTrove(asset: string): Promise<TroveClosureDetails>;

  /**
   * Adjust existing Trove by changing its collateral, debt, or both.
   *
   * @param params - Parameters of the adjustment.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @kumodao/lib-base#Fees.borrowingRate | borrowing rate} if
   *                           `params` includes `borrowKUSD`.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The transaction will fail if the Trove's debt would fall below
   * {@link @kumodao/lib-base#KUSD_MINIMUM_DEBT}.
   *
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    asset: string,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by depositing more collateral.
   *
   * @param amount - The amount of collateral to add to the Trove's existing collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ depositCollateral: amount })
   * ```
   */
  depositCollateral(asset: string, amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by withdrawing some of its collateral.
   *
   * @param amount - The amount of collateral to withdraw from the Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ withdrawCollateral: amount })
   * ```
   */
  withdrawCollateral(asset: string, amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by borrowing more KUSD.
   *
   * @param amount - The amount of KUSD to borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @kumodao/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ borrowKUSD: amount }, maxBorrowingRate)
   * ```
   */
  borrowKUSD(
    asset: string,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by repaying some of its debt.
   *
   * @param amount - The amount of KUSD to repay.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ repayKUSD: amount })
   * ```
   */
  repayKUSD(asset: string, amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /** @internal */
  setPrice(asset: string, price: Decimalish): Promise<void>;

  /**
   * Liquidate one or more undercollateralized Troves.
   *
   * @param address - Address or array of addresses whose Troves to liquidate.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidate(asset: string, address: string | string[]): Promise<LiquidationDetails>;

  /**
   * Liquidate the least collateralized Troves up to a maximum number.
   *
   * @param maximumNumberOfTrovesToLiquidate - Stop after liquidating this many Troves.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(asset: string, maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  /**
   * Make a new Stability Deposit, or top up existing one.
   *
   * @param amount - Amount of KUSD to add to new or existing deposit.
   * @param frontendTag - Address that should receive a share of this deposit's KUMO rewards.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The `frontendTag` parameter is only effective when making a new deposit.
   *
   * As a side-effect, the transaction will also pay out an existing Stability Deposit's
   * {@link @kumodao/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @kumodao/lib-base#StabilityDeposit.kumoReward | KUMO reward}.
   */
  depositKUSDInStabilityPool(
    amount: Decimalish,
    asset: string
  ): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw KUSD from Stability Deposit.
   *
   * @param amount - Amount of KUSD to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @kumodao/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @kumodao/lib-base#StabilityDeposit.kumoReward | KUMO reward}.
   */
  withdrawKUSDFromStabilityPool(amount: Decimalish, asset: string): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw {@link @kumodao/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @kumodao/lib-base#StabilityDeposit.kumoReward | KUMO reward} from Stability Deposit.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(asset: string): Promise<StabilityPoolGainsWithdrawalDetails>;

  /**
   * Transfer {@link @kumodao/lib-base#StabilityDeposit.collateralGain | collateral gain} from
   * Stability Deposit to Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The collateral gain is transfered to the Trove as additional collateral.
   *
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @kumodao/lib-base#StabilityDeposit.kumoReward | KUMO reward}.
   */
  transferCollateralGainToTrove(asset: string, assetName: string): Promise<CollateralGainTransferDetails>;

  /**
   * Send KUSD tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of KUSD to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendKUSD(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Request Test tokens to an address.
   *
   * @param tokenAddress - Address of test token contract.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  requestTestToken(tokenAddress: string): Promise<void>;


  /**
   * Request Test tokens to an address.
   *
   * @param tokenAddress - Address of test token contract.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  transferTestTokens(tokenAddress: string,
    toAddress: string,
    amount: Decimalish): Promise<void>;

  /**
   * Send KUMO tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of KUMO to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendKUMO(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Redeem KUSD to native currency (e.g. Ether) at face value.
   *
   * @param amount - Amount of KUSD to be redeemed.
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @kumodao/lib-base#Fees.redemptionRate | redemption rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the current redemption rate (based on `amount`) plus 0.1%
   * is used as maximum acceptable rate.
   */
  redeemKUSD(asset: string, amount: Decimalish, maxRedemptionRate?: Decimalish): Promise<RedemptionDetails>;

  /**
   * Claim leftover collateral after a liquidation or redemption.
   *
   * @remarks
   * Use {@link @kumodao/lib-base#ReadableKumo.getCollateralSurplusBalance | getCollateralSurplusBalance()}
   * to check the amount of collateral available for withdrawal.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(asset: string): Promise<void>;

  /**
   * Stake KUMO to start earning fee revenue or increase existing stake.
   *
   * @param amount - Amount of KUMO to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out an existing KUMO stake's
   * {@link @kumodao/lib-base#KUMOStake.collateralGain | collateral gain} and
   * {@link @kumodao/lib-base#KUMOStake.kusdGain | KUSD gain}.
   */
  stakeKUMO(amount: Decimalish): Promise<void>;

  /**
   * Withdraw KUMO from staking.
   *
   * @param amount - Amount of KUMO to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the KUMO stake's
   * {@link @kumodao/lib-base#KUMOStake.collateralGain | collateral gain} and
   * {@link @kumodao/lib-base#KUMOStake.kusdGain | KUSD gain}.
   */
  unstakeKUMO(amount: Decimalish): Promise<void>;

  /**
   * Withdraw {@link @kumodao/lib-base#KUMOStake.collateralGain | collateral gain} and
   * {@link @kumodao/lib-base#KUMOStake.kusdGain | KUSD gain} from KUMO stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(): Promise<void>;

  /**
   * Allow the liquidity mining contract to use Uniswap ETH/KUSD LP tokens for
   * {@link @kumodao/lib-base#TransactableKumo.stakeUniTokens | staking}.
   *
   * @param allowance - Maximum amount of LP tokens that will be transferrable to liquidity mining
   *                    (`2^256 - 1` by default).
   *
   * @remarks
   * Must be performed before calling
   * {@link @kumodao/lib-base#TransactableKumo.stakeUniTokens | stakeUniTokens()}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  approveUniTokens(allowance?: Decimalish): Promise<void>;

  /**
   * Stake Uniswap ETH/KUSD LP tokens to participate in liquidity mining and earn KUMO.
   *
   * @param amount - Amount of LP tokens to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  stakeUniTokens(amount: Decimalish): Promise<void>;

  /**
   * Withdraw Uniswap ETH/KUSD LP tokens from liquidity mining.
   *
   * @param amount - Amount of LP tokens to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  unstakeUniTokens(amount: Decimalish): Promise<void>;

  /**
   * Withdraw KUMO that has been earned by mining liquidity.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawKUMORewardFromLiquidityMining(): Promise<void>;

  /**
   * Withdraw all staked LP tokens from liquidity mining and claim reward.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  exitLiquidityMining(): Promise<void>;
}
