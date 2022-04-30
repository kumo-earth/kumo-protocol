import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two states of an KUMO Stake.
 *
 * @public
 */
export type KUMOStakeChange<T> =
  | { stakeKUMO: T; unstakeKUMO?: undefined }
  | { stakeKUMO?: undefined; unstakeKUMO: T; unstakeAllKUMO: boolean };

/** 
 * Represents a user's KUMO stake and accrued gains.
 * 
 * @remarks
 * Returned by the {@link ReadableKumo.getKUMOStake | getKUMOStake()} function.

 * @public
 */
export class KUMOStake {
  /** The amount of KUMO that's staked. */
  readonly stakedKUMO: Decimal;

  /** Collateral gain available to withdraw. */
  readonly collateralGain: Decimal;

  /** KUSD gain available to withdraw. */
  readonly kusdGain: Decimal;

  /** @internal */
  constructor(stakedKUMO = Decimal.ZERO, collateralGain = Decimal.ZERO, kusdGain = Decimal.ZERO) {
    this.stakedKUMO = stakedKUMO;
    this.collateralGain = collateralGain;
    this.kusdGain = kusdGain;
  }

  get isEmpty(): boolean {
    return this.stakedKUMO.isZero && this.collateralGain.isZero && this.kusdGain.isZero;
  }

  /** @internal */
  toString(): string {
    return (
      `{ stakedKUMO: ${this.stakedKUMO}` +
      `, collateralGain: ${this.collateralGain}` +
      `, kusdGain: ${this.kusdGain} }`
    );
  }

  /**
   * Compare to another instance of `KUMOStake`.
   */
  equals(that: KUMOStake): boolean {
    return (
      this.stakedKUMO.eq(that.stakedKUMO) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.kusdGain.eq(that.kusdGain)
    );
  }

  /**
   * Calculate the difference between this `KUMOStake` and `thatStakedKUMO`.
   *
   * @returns An object representing the change, or `undefined` if the staked amounts are equal.
   */
  whatChanged(thatStakedKUMO: Decimalish): KUMOStakeChange<Decimal> | undefined {
    thatStakedKUMO = Decimal.from(thatStakedKUMO);

    if (thatStakedKUMO.lt(this.stakedKUMO)) {
      return {
        unstakeKUMO: this.stakedKUMO.sub(thatStakedKUMO),
        unstakeAllKUMO: thatStakedKUMO.isZero
      };
    }

    if (thatStakedKUMO.gt(this.stakedKUMO)) {
      return { stakeKUMO: thatStakedKUMO.sub(this.stakedKUMO) };
    }
  }

  /**
   * Apply a {@link KUMOStakeChange} to this `KUMOStake`.
   *
   * @returns The new staked KUMO amount.
   */
  apply(change: KUMOStakeChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.stakedKUMO;
    }

    if (change.unstakeKUMO !== undefined) {
      return change.unstakeAllKUMO || this.stakedKUMO.lte(change.unstakeKUMO)
        ? Decimal.ZERO
        : this.stakedKUMO.sub(change.unstakeKUMO);
    } else {
      return this.stakedKUMO.add(change.stakeKUMO);
    }
  }
}
