import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositKUSD: T; withdrawKUSD?: undefined }
  | { depositKUSD?: undefined; withdrawKUSD: T; withdrawAllKUSD: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of KUSD in the Stability Deposit at the time of the last direct modification. */
  readonly initialKUSD: Decimal;

  /** Amount of KUSD left in the Stability Deposit. */
  readonly currentKUSD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up KUSD. */
  readonly collateralGain: Decimal;

  /** Amount of KUMO rewarded since the last modification of the Stability Deposit. */
  readonly kumoReward: Decimal;


  /** @internal */
  constructor(
    initialKUSD: Decimal,
    currentKUSD: Decimal,
    collateralGain: Decimal,
    kumoReward: Decimal
  ) {
    this.initialKUSD = initialKUSD;
    this.currentKUSD = currentKUSD;
    this.collateralGain = collateralGain;
    this.kumoReward = kumoReward;

    if (this.currentKUSD.gt(this.initialKUSD)) {
      throw new Error("currentKUSD can't be greater than initialKUSD");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialKUSD.isZero &&
      this.currentKUSD.isZero &&
      this.collateralGain.isZero &&
      this.kumoReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialKUSD: ${this.initialKUSD}` +
      `, currentKUSD: ${this.currentKUSD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, kumoReward: ${this.kumoReward}`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initialKUSD.eq(that.initialKUSD) &&
      this.currentKUSD.eq(that.currentKUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.kumoReward.eq(that.kumoReward)
    );
  }

  /**
   * Calculate the difference between the `currentKUSD` in this Stability Deposit and `thatKUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatKUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatKUSD = Decimal.from(thatKUSD);

    if (thatKUSD.lt(this.currentKUSD)) {
      return { withdrawKUSD: this.currentKUSD.sub(thatKUSD), withdrawAllKUSD: thatKUSD.isZero };
    }

    if (thatKUSD.gt(this.currentKUSD)) {
      return { depositKUSD: thatKUSD.sub(this.currentKUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited KUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentKUSD;
    }

    if (change.withdrawKUSD !== undefined) {
      return change.withdrawAllKUSD || this.currentKUSD.lte(change.withdrawKUSD)
        ? Decimal.ZERO
        : this.currentKUSD.sub(change.withdrawKUSD);
    } else {
      return this.currentKUSD.add(change.depositKUSD);
    }
  }
}
