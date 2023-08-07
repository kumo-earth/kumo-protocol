import assert from "assert";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Log } from "@ethersproject/abstract-provider";
import { ErrorCode } from "@ethersproject/logger";
import { Transaction } from "@ethersproject/transactions";

import {
  CollateralGainTransferDetails,
  Decimal,
  Decimalish,
  LiquidationDetails,
  KumoReceipt,
  KUSD_MINIMUM_DEBT,
  KUSD_MINIMUM_NET_DEBT,
  MinedReceipt,
  PopulatableKumo,
  PopulatedKumoTransaction,
  PopulatedRedemption,
  RedemptionDetails,
  SentKumoTransaction,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  Trove,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams,
  TroveWithPendingRedistribution,
  _failedReceipt,
  _normalizeTroveAdjustment,
  _normalizeTroveCreation,
  _pendingReceipt,
  _successfulReceipt
} from "@kumodao/lib-base";

import {
  EthersPopulatedTransaction,
  EthersTransactionOverrides,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import {
  EthersKumoConnection,
  _getContracts,
  _requireAddress,
  _requireSigner,
  _getStabilityPoolByAsset
} from "./EthersKumoConnection";

import { decimalify, promiseAllValues } from "./_utils";
import { _priceFeedIsTestnet, _uniTokenIsMock } from "./contracts";
import { logsToString } from "./parseLogs";
import { ReadableEthersKumo } from "./ReadableEthersKumo";

const bigNumberMax = (a: BigNumber, b?: BigNumber) => (b?.gt(a) ? b : a);

// With 70 iterations redemption costs about ~10M gas, and each iteration accounts for ~138k more
/** @internal */
export const _redeemMaxIterations = 70;

const defaultBorrowingRateSlippageTolerance = Decimal.from(0.005); // 0.5%
const defaultRedemptionRateSlippageTolerance = Decimal.from(0.001); // 0.1%
const defaultBorrowingFeeDecayToleranceMinutes = 10;

const noDetails = () => undefined;

const compose =
  <T, U, V>(f: (_: U) => V, g: (_: T) => U) =>
    (_: T) =>
      f(g(_));

const id = <T>(t: T) => t;

// Takes ~6-7K (use 10K to be safe) to update lastFeeOperationTime, but the cost of calculating the
// decayed baseRate increases logarithmically with time elapsed since the last update.
const addGasForBaseRateUpdate =
  (maxMinutesSinceLastUpdate = 10) =>
    (gas: BigNumber) =>
      gas.add(10000 + 1414 * Math.ceil(Math.log2(maxMinutesSinceLastUpdate + 1)));

// First traversal in ascending direction takes ~50K, then ~13.5K per extra step.
// 80K should be enough for 3 steps, plus some extra to be safe.
const addGasForPotentialListTraversal = (gas: BigNumber) => gas.add(80000);

const addGasForKUMOIssuance = (gas: BigNumber) => gas.add(50000);

const addGasForUnipoolRewardUpdate = (gas: BigNumber) => gas.add(20000);

// To get the best entropy available, we'd do something like:
//
// const bigRandomNumber = () =>
//   BigNumber.from(
//     `0x${Array.from(crypto.getRandomValues(new Uint32Array(8)))
//       .map(u32 => u32.toString(16).padStart(8, "0"))
//       .join("")}`
//   );
//
// However, Window.crypto is browser-specific. Since we only use this for randomly picking Troves
// during the search for hints, Math.random() will do fine, too.
//
// This returns a random integer between 0 and Number.MAX_SAFE_INTEGER
const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// Maximum number of trials to perform in a single getApproxHint() call. If the number of trials
// required to get a statistically "good" hint is larger than this, the search for the hint will
// be broken up into multiple getApproxHint() calls.
//
// This should be low enough to work with popular public Ethereum providers like Infura without
// triggering any fair use limits.
const maxNumberOfTrialsAtOnce = 2500;

function* generateTrials(totalNumberOfTrials: number) {
  assert(Number.isInteger(totalNumberOfTrials) && totalNumberOfTrials > 0);

  while (totalNumberOfTrials) {
    const numberOfTrials = Math.min(totalNumberOfTrials, maxNumberOfTrialsAtOnce);
    yield numberOfTrials;

    totalNumberOfTrials -= numberOfTrials;
  }
}

/** @internal */
export enum _RawErrorReason {
  TRANSACTION_FAILED = "transaction failed",
  TRANSACTION_CANCELLED = "cancelled",
  TRANSACTION_REPLACED = "replaced",
  TRANSACTION_REPRICED = "repriced"
}

const transactionReplacementReasons: unknown[] = [
  _RawErrorReason.TRANSACTION_CANCELLED,
  _RawErrorReason.TRANSACTION_REPLACED,
  _RawErrorReason.TRANSACTION_REPRICED
];

interface RawTransactionFailedError extends Error {
  code: ErrorCode.CALL_EXCEPTION;
  reason: _RawErrorReason.TRANSACTION_FAILED;
  transactionHash: string;
  transaction: Transaction;
  receipt: EthersTransactionReceipt;
}

/** @internal */
export interface _RawTransactionReplacedError extends Error {
  code: ErrorCode.TRANSACTION_REPLACED;
  reason:
  | _RawErrorReason.TRANSACTION_CANCELLED
  | _RawErrorReason.TRANSACTION_REPLACED
  | _RawErrorReason.TRANSACTION_REPRICED;
  cancelled: boolean;
  hash: string;
  replacement: EthersTransactionResponse;
  receipt: EthersTransactionReceipt;
}

const hasProp = <T, P extends string>(o: T, p: P): o is T & { [_ in P]: unknown } => p in o;

const isTransactionFailedError = (error: Error): error is RawTransactionFailedError =>
  hasProp(error, "code") &&
  error.code === ErrorCode.CALL_EXCEPTION &&
  hasProp(error, "reason") &&
  error.reason === _RawErrorReason.TRANSACTION_FAILED;

const isTransactionReplacedError = (error: Error): error is _RawTransactionReplacedError =>
  hasProp(error, "code") &&
  error.code === ErrorCode.TRANSACTION_REPLACED &&
  hasProp(error, "reason") &&
  transactionReplacementReasons.includes(error.reason);

/**
 * Thrown when a transaction is cancelled or replaced by a different transaction.
 *
 * @public
 */
export class EthersTransactionCancelledError extends Error {
  readonly rawReplacementReceipt: EthersTransactionReceipt;
  readonly rawError: Error;

  /** @internal */
  constructor(rawError: _RawTransactionReplacedError) {
    assert(rawError.reason !== _RawErrorReason.TRANSACTION_REPRICED);

    super(`Transaction ${rawError.reason}`);
    this.name = "TransactionCancelledError";
    this.rawReplacementReceipt = rawError.receipt;
    this.rawError = rawError;
  }
}

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Returned by {@link SendableEthersKumo} functions.
 *
 * @public
 */
export class SentEthersKumoTransaction<T = unknown>
  implements
  SentKumoTransaction<EthersTransactionResponse, KumoReceipt<EthersTransactionReceipt, T>>
{
  /** Ethers' representation of a sent transaction. */
  readonly rawSentTransaction: EthersTransactionResponse;

  private readonly _connection: EthersKumoConnection;
  private readonly _parse: (rawReceipt: EthersTransactionReceipt) => T;

  /** @internal */
  constructor(
    rawSentTransaction: EthersTransactionResponse,
    connection: EthersKumoConnection,
    parse: (rawReceipt: EthersTransactionReceipt) => T
  ) {
    this.rawSentTransaction = rawSentTransaction;
    this._connection = connection;
    this._parse = parse;
  }

  private _receiptFrom(rawReceipt: EthersTransactionReceipt | null) {
    return rawReceipt
      ? rawReceipt.status
        ? _successfulReceipt(rawReceipt, this._parse(rawReceipt), () =>
          logsToString(rawReceipt, _getContracts(this._connection))
        )
        : _failedReceipt(rawReceipt)
      : _pendingReceipt;
  }

  private async _waitForRawReceipt(confirmations?: number) {
    try {
      return await this.rawSentTransaction.wait(confirmations);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (isTransactionFailedError(error)) {
          return error.receipt;
        }

        if (isTransactionReplacedError(error)) {
          if (error.cancelled) {
            throw new EthersTransactionCancelledError(error);
          } else {
            return error.receipt;
          }
        }
      }

      throw error;
    }
  }

  /** {@inheritDoc @kumodao/lib-base#SentKumoTransaction.getReceipt} */
  async getReceipt(): Promise<KumoReceipt<EthersTransactionReceipt, T>> {
    return this._receiptFrom(await this._waitForRawReceipt(0));
  }

  /**
   * {@inheritDoc @kumodao/lib-base#SentKumoTransaction.waitForReceipt}
   *
   * @throws
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  async waitForReceipt(): Promise<MinedReceipt<EthersTransactionReceipt, T>> {
    const receipt = this._receiptFrom(await this._waitForRawReceipt());
    assert(receipt.status !== "pending");
    return receipt;
  }
}

/**
 * Optional parameters of a transaction that borrows KUSD.
 *
 * @public
 */
export interface BorrowingOperationOptionalParams {
  /**
   * Maximum acceptable {@link @kumodao/lib-base#Fees.borrowingRate | borrowing rate}
   * (default: current borrowing rate plus 0.5%).
   */
  maxBorrowingRate?: Decimalish;

  /**
   * Control the amount of extra gas included attached to the transaction.
   *
   * @remarks
   * Transactions that borrow KUSD must pay a variable borrowing fee, which is added to the Trove's
   * debt. This fee increases whenever a redemption occurs, and otherwise decays exponentially.
   * Due to this decay, a Trove's collateral ratio can end up being higher than initially calculated
   * if the transaction is pending for a long time. When this happens, the backend has to iterate
   * over the sorted list of Troves to find a new position for the Trove, which costs extra gas.
   *
   * The SDK can estimate how much the gas costs of the transaction may increase due to this decay,
   * and can include additional gas to ensure that it will still succeed, even if it ends up pending
   * for a relatively long time. This parameter specifies the length of time that should be covered
   * by the extra gas.
   *
   * Default: 10 minutes.
   */
  borrowingFeeDecayToleranceMinutes?: number;
}

const normalizeBorrowingOperationOptionalParams = (
  maxBorrowingRateOrOptionalParams: Decimalish | BorrowingOperationOptionalParams | undefined,
  currentBorrowingRate: Decimal | undefined
): {
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
} => {
  if (maxBorrowingRateOrOptionalParams === undefined) {
    return {
      maxBorrowingRate:
        currentBorrowingRate?.add(defaultBorrowingRateSlippageTolerance) ?? Decimal.ZERO,
      borrowingFeeDecayToleranceMinutes: defaultBorrowingFeeDecayToleranceMinutes
    };
  } else if (
    typeof maxBorrowingRateOrOptionalParams === "number" ||
    typeof maxBorrowingRateOrOptionalParams === "string" ||
    maxBorrowingRateOrOptionalParams instanceof Decimal
  ) {
    return {
      maxBorrowingRate: Decimal.from(maxBorrowingRateOrOptionalParams),
      borrowingFeeDecayToleranceMinutes: defaultBorrowingFeeDecayToleranceMinutes
    };
  } else {
    const { maxBorrowingRate, borrowingFeeDecayToleranceMinutes } = maxBorrowingRateOrOptionalParams;

    return {
      maxBorrowingRate:
        maxBorrowingRate !== undefined
          ? Decimal.from(maxBorrowingRate)
          : currentBorrowingRate?.add(defaultBorrowingRateSlippageTolerance) ?? Decimal.ZERO,

      borrowingFeeDecayToleranceMinutes:
        borrowingFeeDecayToleranceMinutes ?? defaultBorrowingFeeDecayToleranceMinutes
    };
  }
};

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Returned by {@link PopulatableEthersKumo} functions.
 *
 * @public
 */
export class PopulatedEthersKumoTransaction<T = unknown>
  implements PopulatedKumoTransaction<EthersPopulatedTransaction, SentEthersKumoTransaction<T>>
{
  /** Unsigned transaction object populated by Ethers. */
  readonly rawPopulatedTransaction: EthersPopulatedTransaction;

  /**
   * Extra gas added to the transaction's `gasLimit` on top of the estimated minimum requirement.
   *
   * @remarks
   * Gas estimation is based on blockchain state at the latest block. However, most transactions
   * stay in pending state for several blocks before being included in a block. This may increase
   * the actual gas requirements of certain Kumo transactions by the time they are eventually
   * mined, therefore the Kumo SDK increases these transactions' `gasLimit` by default (unless
   * `gasLimit` is {@link EthersTransactionOverrides | overridden}).
   *
   * Note: even though the SDK includes gas headroom for many transaction types, currently this
   * property is only implemented for {@link PopulatableEthersKumo.openTrove | openTrove()},
   * {@link PopulatableEthersKumo.adjustTrove | adjustTrove()} and its aliases.
   */
  readonly gasHeadroom?: number;

  private readonly _connection: EthersKumoConnection;
  private readonly _parse: (rawReceipt: EthersTransactionReceipt) => T;

  /** @internal */
  constructor(
    rawPopulatedTransaction: EthersPopulatedTransaction,
    connection: EthersKumoConnection,
    parse: (rawReceipt: EthersTransactionReceipt) => T,
    gasHeadroom?: number
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this._connection = connection;
    this._parse = parse;

    if (gasHeadroom !== undefined) {
      this.gasHeadroom = gasHeadroom;
    }
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatedKumoTransaction.send} */
  async send(): Promise<SentEthersKumoTransaction<T>> {
    return new SentEthersKumoTransaction(
      await _requireSigner(this._connection).sendTransaction(this.rawPopulatedTransaction),
      this._connection,
      this._parse
    );
  }
}

/**
 * {@inheritDoc @kumodao/lib-base#PopulatedRedemption}
 *
 * @public
 */
export class PopulatedEthersRedemption
  extends PopulatedEthersKumoTransaction<RedemptionDetails>
  implements
  PopulatedRedemption<
    EthersPopulatedTransaction,
    EthersTransactionResponse,
    EthersTransactionReceipt
  >
{
  /** {@inheritDoc @kumodao/lib-base#PopulatedRedemption.attemptedKUSDAmount} */
  readonly attemptedKUSDAmount: Decimal;

  /** {@inheritDoc @kumodao/lib-base#PopulatedRedemption.redeemableKUSDAmount} */
  readonly redeemableKUSDAmount: Decimal;

  /** {@inheritDoc @kumodao/lib-base#PopulatedRedemption.isTruncated} */
  readonly isTruncated: boolean;

  private readonly _increaseAmountByMinimumNetDebt?: (
    maxRedemptionRate?: Decimalish
  ) => Promise<PopulatedEthersRedemption>;

  /** @internal */
  constructor(
    rawPopulatedTransaction: EthersPopulatedTransaction,
    connection: EthersKumoConnection,
    attemptedKUSDAmount: Decimal,
    redeemableKUSDAmount: Decimal,
    increaseAmountByMinimumNetDebt?: (
      maxRedemptionRate?: Decimalish
    ) => Promise<PopulatedEthersRedemption>
  ) {
    const { troveManager } = _getContracts(connection);

    super(
      rawPopulatedTransaction,
      connection,

      ({ logs }) =>
        troveManager
          .extractEvents(logs, "Redemption")
          .map(({ args: { _AssetSent, _AssetFee, _actualKUSDAmount, _attemptedKUSDAmount } }) => ({
            attemptedKUSDAmount: decimalify(_attemptedKUSDAmount),
            actualKUSDAmount: decimalify(_actualKUSDAmount),
            collateralTaken: decimalify(_AssetSent),
            fee: decimalify(_AssetFee)
          }))[0]
    );

    this.attemptedKUSDAmount = attemptedKUSDAmount;
    this.redeemableKUSDAmount = redeemableKUSDAmount;
    this.isTruncated = redeemableKUSDAmount.lt(attemptedKUSDAmount);
    this._increaseAmountByMinimumNetDebt = increaseAmountByMinimumNetDebt;
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt} */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedEthersRedemption> {
    if (!this._increaseAmountByMinimumNetDebt) {
      throw new Error(
        "PopulatedEthersRedemption: increaseAmountByMinimumNetDebt() can " +
        "only be called when amount is truncated"
      );
    }

    return this._increaseAmountByMinimumNetDebt(maxRedemptionRate);
  }
}

/** @internal */
export interface _TroveChangeWithFees<T> {
  params: T;
  newTrove: Trove;
  fee: Decimal;
}

/**
 * Ethers-based implementation of {@link @kumodao/lib-base#PopulatableKumo}.
 *
 * @public
 */
export class PopulatableEthersKumo
  implements
  PopulatableKumo<EthersTransactionReceipt, EthersTransactionResponse, EthersPopulatedTransaction>
{
  private readonly _readable: ReadableEthersKumo;

  constructor(readable: ReadableEthersKumo) {
    this._readable = readable;
  }

  private _wrapSimpleTransaction(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersKumoTransaction<void> {
    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,
      noDetails
    );
  }

  private _wrapTroveChangeWithFees<T>(
    params: T,
    rawPopulatedTransaction: EthersPopulatedTransaction,
    gasHeadroom?: number
  ): PopulatedEthersKumoTransaction<_TroveChangeWithFees<T>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const [newTrove] = borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(decimalify(_coll), decimalify(_debt)));

        const [fee] = borrowerOperations
          .extractEvents(logs, "KUSDBorrowingFeePaid")
          .map(({ args: { _KUSDFee } }) => decimalify(_KUSDFee));

        return {
          params,
          newTrove,
          fee
        };
      },

      gasHeadroom
    );
  }

  private async _wrapTroveClosure(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): Promise<PopulatedEthersKumoTransaction<TroveClosureDetails>> {
    const { activePool, kusdToken } = _getContracts(this._readable.connection);

    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs, from: userAddress }) => {
        const [repayKUSD] = kusdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === userAddress && to === AddressZero)
          .map(({ args: { value } }) => decimalify(value));

        const [withdrawCollateral] = activePool
          .extractEvents(logs, "AssetSent")
          .filter(({ args: { _to } }) => _to === userAddress)
          .map(({ args: { _amount } }) => decimalify(_amount));

        return {
          params: repayKUSD.nonZero ? { withdrawCollateral, repayKUSD } : { withdrawCollateral }
        };
      }
    );
  }

  private _wrapLiquidation(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersKumoTransaction<LiquidationDetails> {
    const { troveManager } = _getContracts(this._readable.connection);

    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const liquidatedAddresses = troveManager
          .extractEvents(logs, "TroveLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = troveManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _kusdGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: decimalify(_collGasCompensation),
              kusdGasCompensation: decimalify(_kusdGasCompensation),
              totalLiquidated: new Trove(decimalify(_liquidatedColl), decimalify(_liquidatedDebt))
            })
          );

        return {
          liquidatedAddresses,
          ...totals
        };
      }
    );
  }

  private _extractStabilityPoolGainsWithdrawalDetails(
    assetName: string,
    logs: Log[]
  ): StabilityPoolGainsWithdrawalDetails {
    // const { stabilityPool } = _getContracts(this._readable.connection);
    const stabilityPool = _getStabilityPoolByAsset(assetName, this._readable.connection);

    const [newKUSDDeposit] = stabilityPool
      .extractEvents(logs, "UserDepositChanged")
      .map(({ args: { _newDeposit } }) => decimalify(_newDeposit));

    const [[collateralGain, kusdLoss]] = stabilityPool
      .extractEvents(logs, "AssetGainWithdrawn")
      .map(({ args: { _Asset, _kusdLoss } }) => [decimalify(_Asset), decimalify(_kusdLoss)]);

    const [kumoReward] = stabilityPool
      .extractEvents(logs, "KUMOPaidToDepositor")
      .map(({ args: { _KUMO } }) => decimalify(_KUMO));

    return {
      kusdLoss,
      newKUSDDeposit,
      collateralGain,
      kumoReward
    };
  }

  private _wrapStabilityPoolGainsWithdrawal(
    asset: string,
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersKumoTransaction<StabilityPoolGainsWithdrawalDetails> {
    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,
      ({ logs }) => this._extractStabilityPoolGainsWithdrawalDetails(asset, logs)
    );
  }

  private _wrapStabilityDepositTopup(
    asset: string,
    change: { depositKUSD: Decimal },
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersKumoTransaction<StabilityDepositChangeDetails> {
    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => ({
        ...this._extractStabilityPoolGainsWithdrawalDetails(asset, logs),
        change
      })
    );
  }

  private async _wrapStabilityDepositWithdrawal(
    assetName: string,
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): Promise<PopulatedEthersKumoTransaction<StabilityDepositChangeDetails>> {
    const stabilityPool = _getStabilityPoolByAsset(assetName, this._readable.connection);
    const { kusdToken } = _getContracts(this._readable.connection);

    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs, from: userAddress }) => {
        const gainsWithdrawalDetails = this._extractStabilityPoolGainsWithdrawalDetails(
          assetName,
          logs
        );

        const [withdrawKUSD] = kusdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === stabilityPool.address && to === userAddress)
          .map(({ args: { value } }) => decimalify(value));

        return {
          ...gainsWithdrawalDetails,
          change: { withdrawKUSD, withdrawAllKUSD: gainsWithdrawalDetails.newKUSDDeposit.isZero }
        };
      }
    );
  }

  private _wrapCollateralGainTransfer(
    assetName: string,
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersKumoTransaction<CollateralGainTransferDetails> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return new PopulatedEthersKumoTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const [newTrove] = borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(decimalify(_coll), decimalify(_debt)));

        return {
          ...this._extractStabilityPoolGainsWithdrawalDetails(assetName, logs),
          newTrove
        };
      }
    );
  }

  private async _findHintsForNominalCollateralRatio(
    asset: string,
    nominalCollateralRatio: Decimal,
    ownAddress?: string
  ): Promise<[string, string]> {
    const { sortedTroves, hintHelpers } = _getContracts(this._readable.connection);
    const numberOfTroves = await this._readable.getNumberOfTroves(asset);

    if (!numberOfTroves) {
      return [AddressZero, AddressZero];
    }

    if (nominalCollateralRatio.infinite) {
      return [AddressZero, await sortedTroves.getFirst(asset)];
    }

    const totalNumberOfTrials = Math.ceil(10 * Math.sqrt(numberOfTroves));
    const [firstTrials, ...restOfTrials] = generateTrials(totalNumberOfTrials);
    const collectApproxHint = (
      {
        latestRandomSeed,
        results
      }: {
        latestRandomSeed: BigNumberish;
        results: { diff: BigNumber; hintAddress: string }[];
      },
      numberOfTrials: number
    ) =>
      hintHelpers
        .getApproxHint(asset, nominalCollateralRatio.hex, numberOfTrials, latestRandomSeed)
        .then(({ latestRandomSeed, ...result }) => ({
          latestRandomSeed,
          results: [...results, result]
        }));

    const { results } = await restOfTrials.reduce(
      (p, numberOfTrials) => p.then(state => collectApproxHint(state, numberOfTrials)),
      collectApproxHint({ latestRandomSeed: randomInteger(), results: [] }, firstTrials)
    );

    const { hintAddress } = results.reduce((a, b) => (a.diff.lt(b.diff) ? a : b));

    let [prev, next] = await sortedTroves.findInsertPosition(
      asset,
      nominalCollateralRatio.hex,
      hintAddress,
      hintAddress
    );

    if (ownAddress) {
      // In the case of reinsertion, the address of the Trove being reinserted is not a usable hint,
      // because it is deleted from the list before the reinsertion.
      // "Jump over" the Trove to get the proper hint.
      if (prev === ownAddress) {
        prev = await sortedTroves.getPrev(asset, prev);
      } else if (next === ownAddress) {
        next = await sortedTroves.getNext(asset, next);
      }
    }

    // Don't use `address(0)` as hint as it can result in huge gas cost.
    // (See https://github.com/liquity/dev/issues/600).
    if (prev === AddressZero) {
      prev = next;
    } else if (next === AddressZero) {
      next = prev;
    }

    return [prev, next];
  }

  private async _findHints(
    asset: string,
    trove: Trove,
    ownAddress?: string
  ): Promise<[string, string]> {
    if (trove instanceof TroveWithPendingRedistribution) {
      throw new Error("Rewards must be applied to this Trove");
    }

    return this._findHintsForNominalCollateralRatio(
      asset,
      trove._nominalCollateralRatio,
      ownAddress
    );
  }

  private async _findRedemptionHints(
    asset: string,
    amount: Decimal
  ): Promise<
    [
      truncatedAmount: Decimal,
      firstRedemptionHint: string,
      partialRedemptionUpperHint: string,
      partialRedemptionLowerHint: string,
      partialRedemptionHintNICR: BigNumber
    ]
  > {
    const { hintHelpers } = _getContracts(this._readable.connection);
    const price = await this._readable.getPrice(asset);

    const { firstRedemptionHint, partialRedemptionHintNICR, truncatedKUSDamount } =
      await hintHelpers.getRedemptionHints(asset, amount.hex, price.hex, _redeemMaxIterations);

    const [partialRedemptionUpperHint, partialRedemptionLowerHint] =
      partialRedemptionHintNICR.isZero()
        ? [AddressZero, AddressZero]
        : await this._findHintsForNominalCollateralRatio(
          asset,
          decimalify(partialRedemptionHintNICR)
          // XXX: if we knew the partially redeemed Trove's address, we'd pass it here
        );

    return [
      decimalify(truncatedKUSDamount),
      firstRedemptionHint,
      partialRedemptionUpperHint,
      partialRedemptionLowerHint,
      partialRedemptionHintNICR
    ];
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    asset: string,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveCreationDetails>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    const normalizedParams = _normalizeTroveCreation(params);
    const { depositCollateral, borrowKUSD } = normalizedParams;
    // console.log("openTrove", depositCollateral, borrowKUSD)
    const [fees, blockTimestamp, total, price] = await Promise.all([
      this._readable._getFeesFactory(asset),
      this._readable._getBlockTimestamp(),
      this._readable.getTotal(asset),
      this._readable.getPrice(asset)
    ]);
    // console.log("openTrove", fees, blockTimestamp, total, price)
    const recoveryMode = total.collateralRatioIsBelowCritical(price);

    const decayBorrowingRate = (seconds: number) =>
      fees(blockTimestamp + seconds, recoveryMode).borrowingRate();

    const currentBorrowingRate = decayBorrowingRate(0);
    const newTrove = Trove.create(normalizedParams, currentBorrowingRate);
    const hints = await this._findHints(asset, newTrove);

    // console.log("openTrove", decayBorrowingRate, currentBorrowingRate, newTrove, hints)

    const { maxBorrowingRate, borrowingFeeDecayToleranceMinutes } =
      normalizeBorrowingOperationOptionalParams(
        maxBorrowingRateOrOptionalParams,
        currentBorrowingRate
      );

    const txParams = (borrowKUSD: Decimal): Parameters<typeof borrowerOperations.openTrove> => [
      asset,
      depositCollateral.hex,
      maxBorrowingRate.hex,
      borrowKUSD.hex,
      ...hints,
      { ...overrides }
    ];

    let gasHeadroom: number | undefined;

    if (overrides?.gasLimit === undefined) {
      const decayedBorrowingRate = decayBorrowingRate(60 * borrowingFeeDecayToleranceMinutes);
      const decayedTrove = Trove.create(normalizedParams, decayedBorrowingRate);
      const { borrowKUSD: borrowKUSDSimulatingDecay } = Trove.recreate(
        decayedTrove,
        currentBorrowingRate
      );

      if (decayedTrove.debt.lt(KUSD_MINIMUM_DEBT)) {
        throw new Error(
          `Trove's debt might fall below ${KUSD_MINIMUM_DEBT} ` +
          `within ${borrowingFeeDecayToleranceMinutes} minutes`
        );
      }
      // console.log("openTrove", decayBorrowingRate, currentBorrowingRate, newTrove, hints)
      const [gasNow, gasLater] = await Promise.all([
        borrowerOperations.estimateGas.openTrove(...txParams(borrowKUSD)),
        borrowerOperations.estimateGas.openTrove(...txParams(borrowKUSDSimulatingDecay))
      ]);
      // console.log("openTrove", gasNow, gasLater)
      const gasLimit = addGasForBaseRateUpdate(borrowingFeeDecayToleranceMinutes)(
        bigNumberMax(addGasForPotentialListTraversal(gasNow), gasLater)
      );

      gasHeadroom = gasLimit.sub(gasNow).toNumber();
      overrides = { ...overrides, gasLimit };
    }

    return this._wrapTroveChangeWithFees(
      normalizedParams,
      await borrowerOperations.populateTransaction.openTrove(...txParams(borrowKUSD)),
      gasHeadroom
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.closeTrove} */
  async closeTrove(
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveClosureDetails>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return this._wrapTroveClosure(
      await borrowerOperations.estimateAndPopulate.closeTrove({ ...overrides }, id, asset)
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.depositCollateral} */
  depositCollateral(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ depositCollateral: amount }, asset, undefined, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.withdrawCollateral} */
  withdrawCollateral(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ withdrawCollateral: amount }, asset, undefined, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.borrowKUSD} */
  borrowKUSD(
    asset: string,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ borrowKUSD: amount }, asset, maxBorrowingRate, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.repayKUSD} */
  repayKUSD(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ repayKUSD: amount }, asset, undefined, overrides);
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.adjustTrove} */
  async adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    asset: string,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<TroveAdjustmentDetails>> {
    const address = _requireAddress(this._readable.connection, overrides);
    const { borrowerOperations } = _getContracts(this._readable.connection);

    const normalizedParams = _normalizeTroveAdjustment(params);
    const { depositCollateral, withdrawCollateral, borrowKUSD, repayKUSD } = normalizedParams;

    const [trove, feeVars] = await Promise.all([
      this._readable.getTrove(asset, address),
      borrowKUSD &&
      promiseAllValues({
        fees: this._readable._getFeesFactory(asset),
        blockTimestamp: this._readable._getBlockTimestamp(),
        total: this._readable.getTotal(asset),
        price: this._readable.getPrice(asset)
      })
    ]);

    const decayBorrowingRate = (seconds: number) =>
      feeVars
        ?.fees(
          feeVars.blockTimestamp + seconds,
          feeVars.total.collateralRatioIsBelowCritical(feeVars.price)
        )
        .borrowingRate();

    const currentBorrowingRate = decayBorrowingRate(0);
    const adjustedTrove = trove.adjust(normalizedParams, currentBorrowingRate);
    const hints = await this._findHints(asset, adjustedTrove, address);

    const { maxBorrowingRate, borrowingFeeDecayToleranceMinutes } =
      normalizeBorrowingOperationOptionalParams(
        maxBorrowingRateOrOptionalParams,
        currentBorrowingRate
      );

    const txParams = (borrowKUSD?: Decimal): Parameters<typeof borrowerOperations.adjustTrove> => [
      asset,
      (depositCollateral ?? Decimal.ZERO).hex,
      maxBorrowingRate.hex,
      (withdrawCollateral ?? Decimal.ZERO).hex,
      (borrowKUSD ?? repayKUSD ?? Decimal.ZERO).hex,
      !!borrowKUSD,
      ...hints,
      { ...overrides }
    ];

    let gasHeadroom: number | undefined;

    if (overrides?.gasLimit === undefined) {
      const decayedBorrowingRate = decayBorrowingRate(60 * borrowingFeeDecayToleranceMinutes);
      const decayedTrove = trove.adjust(normalizedParams, decayedBorrowingRate);
      const { borrowKUSD: borrowKUSDSimulatingDecay } = trove.adjustTo(
        decayedTrove,
        currentBorrowingRate
      );

      if (decayedTrove.debt.lt(KUSD_MINIMUM_DEBT)) {
        throw new Error(
          `Trove's debt might fall below ${KUSD_MINIMUM_DEBT} ` +
          `within ${borrowingFeeDecayToleranceMinutes} minutes`
        );
      }

      const [gasNow, gasLater] = await Promise.all([
        borrowerOperations.estimateGas.adjustTrove(...txParams(borrowKUSD)),
        borrowKUSD &&
        borrowerOperations.estimateGas.adjustTrove(...txParams(borrowKUSDSimulatingDecay))
      ]);

      let gasLimit = bigNumberMax(addGasForPotentialListTraversal(gasNow), gasLater);
      if (borrowKUSD) {
        gasLimit = addGasForBaseRateUpdate(borrowingFeeDecayToleranceMinutes)(gasLimit);
      }

      gasHeadroom = gasLimit.sub(gasNow).toNumber();
      overrides = { ...overrides, gasLimit };
    }

    return this._wrapTroveChangeWithFees(
      normalizedParams,
      await borrowerOperations.populateTransaction.adjustTrove(...txParams(borrowKUSD)),
      gasHeadroom
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.claimCollateralSurplus} */
  async claimCollateralSurplus(
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await borrowerOperations.estimateAndPopulate.claimCollateral({ ...overrides }, id, asset)
    );
  }

  /** @internal */
  async setPrice(
    asset: string,
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { priceFeed } = _getContracts(this._readable.connection);

    if (!_priceFeedIsTestnet(priceFeed)) {
      throw new Error("setPrice() unavailable on this deployment of Kumo");
    }

    return this._wrapSimpleTransaction(
      await priceFeed.estimateAndPopulate.setPrice({ ...overrides }, id, asset, Decimal.from(price).hex)
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.liquidate} */
  async liquidate(
    asset: string,
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<LiquidationDetails>> {
    const { troveManager } = _getContracts(this._readable.connection);

    if (Array.isArray(address)) {
      return this._wrapLiquidation(
        await troveManager.estimateAndPopulate.batchLiquidateTroves(
          { ...overrides },
          addGasForKUMOIssuance,
          asset,
          address
        )
      );
    } else {
      return this._wrapLiquidation(
        await troveManager.estimateAndPopulate.liquidate(
          { ...overrides },
          addGasForKUMOIssuance,
          asset,
          address
        )
      );
    }
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.liquidateUpTo} */
  async liquidateUpTo(
    asset: string,
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<LiquidationDetails>> {
    const { troveManager } = _getContracts(this._readable.connection);

    return this._wrapLiquidation(
      await troveManager.estimateAndPopulate.liquidateTroves(
        { ...overrides },
        addGasForKUMOIssuance,
        asset,
        maximumNumberOfTrovesToLiquidate
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.depositKUSDInStabilityPool} */
  async depositKUSDInStabilityPool(
    amount: Decimalish,
    assetName: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<StabilityDepositChangeDetails>> {
    const stabilityPool = _getStabilityPoolByAsset(assetName, this._readable.connection);
    // const { stabilityPool } = _getContracts(this._readable.connection);
    const depositKUSD = Decimal.from(amount);

    return this._wrapStabilityDepositTopup(
      assetName,
      { depositKUSD },
      await stabilityPool.estimateAndPopulate.provideToSP(
        { ...overrides },
        addGasForKUMOIssuance,
        depositKUSD.hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.withdrawKUSDFromStabilityPool} */
  async withdrawKUSDFromStabilityPool(
    amount: Decimalish,
    assetName: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<StabilityDepositChangeDetails>> {
    const stabilityPool = _getStabilityPoolByAsset(assetName, this._readable.connection);
    // const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapStabilityDepositWithdrawal(
      assetName,
      await stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForKUMOIssuance,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.withdrawGainsFromStabilityPool} */
  async withdrawGainsFromStabilityPool(
    assetName: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<StabilityPoolGainsWithdrawalDetails>> {
    const stabilityPool = _getStabilityPoolByAsset(assetName, this._readable.connection);
    return this._wrapStabilityPoolGainsWithdrawal(
      assetName,
      await stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForKUMOIssuance,
        Decimal.ZERO.hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.transferCollateralGainToTrove} */
  async transferCollateralGainToTrove(
    asset: string,
    assetName: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<CollateralGainTransferDetails>> {
    const address = _requireAddress(this._readable.connection, overrides);
    const stabilityPool = _getStabilityPoolByAsset(assetName, this._readable.connection);
    // const { stabilityPool } = _getContracts(this._readable.connection);

    const [initialTrove, stabilityDeposit] = await Promise.all([
      this._readable.getTrove(asset, address),
      this._readable.getStabilityDeposit(assetName, address)
    ]);
    PopulatableEthersKumo
    const finalTrove = initialTrove.addCollateral(stabilityDeposit.collateralGain);

    return this._wrapCollateralGainTransfer(
      assetName,
      await stabilityPool.estimateAndPopulate.withdrawAssetGainToTrove(
        { ...overrides },
        compose(addGasForPotentialListTraversal, addGasForKUMOIssuance),
        ...(await this._findHints(asset, finalTrove, address))
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.sendKUSD} */
  async sendKUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { kusdToken } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await kusdToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.requestTestToken} */
  async requestTestToken(
    tokenAddress: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { kumoFaucet } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await kumoFaucet.estimateAndPopulate.requestTokens(
        { ...overrides },
        id,
        tokenAddress
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.transferTestTokens} */
  async transferTestTokens(
    tokenAddress: string,
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { kumoFaucet } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await kumoFaucet.estimateAndPopulate.transferTestTokens(
        { ...overrides },
        id,
        tokenAddress,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.sendKUMO} */
  async sendKUMO(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { kumoToken } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await kumoToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.redeemKUSD} */
  async redeemKUSD(
    asset: string,
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersRedemption> {
    const { troveManager } = _getContracts(this._readable.connection);
    const attemptedKUSDAmount = Decimal.from(amount);

    const [fees, total, [truncatedAmount, firstRedemptionHint, ...partialHints]] = await Promise.all(
      [
        this._readable.getFees(asset),
        this._readable.getTotal(asset),
        this._findRedemptionHints(asset, attemptedKUSDAmount)
      ]
    );

    if (truncatedAmount.isZero) {
      throw new Error(
        `redeemKUSD: amount too low to redeem (try at least ${KUSD_MINIMUM_NET_DEBT})`
      );
    }

    const defaultMaxRedemptionRate = (amount: Decimal) =>
      Decimal.min(
        fees.redemptionRate(amount.div(total.debt)).add(defaultRedemptionRateSlippageTolerance),
        Decimal.ONE
      );

    const populateRedemption = async (
      asset: string,
      attemptedKUSDAmount: Decimal,
      maxRedemptionRate?: Decimalish,
      truncatedAmount: Decimal = attemptedKUSDAmount,
      partialHints: [string, string, BigNumberish] = [AddressZero, AddressZero, 0]
    ): Promise<PopulatedEthersRedemption> => {
      const maxRedemptionRateOrDefault =
        maxRedemptionRate !== undefined
          ? Decimal.from(maxRedemptionRate)
          : defaultMaxRedemptionRate(truncatedAmount);

      return new PopulatedEthersRedemption(
        await troveManager.estimateAndPopulate.redeemCollateral(
          { ...overrides },
          addGasForBaseRateUpdate(),
          asset,
          truncatedAmount.hex,
          firstRedemptionHint,
          ...partialHints,
          _redeemMaxIterations,
          maxRedemptionRateOrDefault.hex
        ),

        this._readable.connection,
        attemptedKUSDAmount,
        truncatedAmount,

        truncatedAmount.lt(attemptedKUSDAmount)
          ? newMaxRedemptionRate =>
            populateRedemption(
              asset,
              truncatedAmount.add(KUSD_MINIMUM_NET_DEBT),
              newMaxRedemptionRate ?? maxRedemptionRate
            )
          : undefined
      );
    };

    return populateRedemption(
      asset,
      attemptedKUSDAmount,
      maxRedemptionRate,
      truncatedAmount,
      partialHints
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.stakeKUMO} */
  async stakeKUMO(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { kumoStaking } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await kumoStaking.estimateAndPopulate.stake({ ...overrides }, id, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.unstakeKUMO} */
  async unstakeKUMO(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { kumoStaking } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await kumoStaking.estimateAndPopulate.unstake({ ...overrides }, id, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    return this.unstakeKUMO(Decimal.ZERO, overrides);
  }


  /** @internal */
  async _mintUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    address ??= _requireAddress(this._readable.connection, overrides);
    const { uniToken } = _getContracts(this._readable.connection);

    if (!_uniTokenIsMock(uniToken)) {
      throw new Error("_mintUniToken() unavailable on this deployment of Kumo");
    }

    return this._wrapSimpleTransaction(
      await uniToken.estimateAndPopulate.mint(
        { ...overrides },
        id,
        address,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.approveUniTokens} */
  async approveUniTokens(
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { uniToken, unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await uniToken.estimateAndPopulate.approve(
        { ...overrides },
        id,
        unipool.address,
        Decimal.from(allowance ?? Decimal.INFINITY).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.stakeUniTokens} */
  async stakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.stake(
        { ...overrides },
        addGasForUnipoolRewardUpdate,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.unstakeUniTokens} */
  async unstakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.withdraw(
        { ...overrides },
        addGasForUnipoolRewardUpdate,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.withdrawKUMORewardFromLiquidityMining} */
  async withdrawKUMORewardFromLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.claimReward({ ...overrides }, addGasForUnipoolRewardUpdate)
    );
  }

  /** {@inheritDoc @kumodao/lib-base#PopulatableKumo.exitLiquidityMining} */
  async exitLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersKumoTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.withdrawAndClaim(
        { ...overrides },
        addGasForUnipoolRewardUpdate
      )
    );
  }
}
