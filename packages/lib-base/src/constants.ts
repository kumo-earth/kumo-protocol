import { Decimal } from "./Decimal";

interface ASSET_TOKENS_TYPES<T> {
  [key: string]: T;
}

interface AssetType {
  assetAddress: string;
  CRITICAL_COLLATERAL_RATIO: Decimal;
  MINIMUM_COLLATERAL_RATIO: Decimal;
}
/**
 * Assets Types
 */
export const ASSET_TOKENS: ASSET_TOKENS_TYPES<AssetType> = {
  ctx: {
    assetAddress: "0xB861c98B465272765c5B2F651471Ea8a65871ACd",
    CRITICAL_COLLATERAL_RATIO: Decimal.from(1.5),
    MINIMUM_COLLATERAL_RATIO: Decimal.from(1.1)
  },
  cty: {
    assetAddress: "0x3E474b98BA08CdF37543d6c8aa6F0e9B260F4881",
    CRITICAL_COLLATERAL_RATIO: Decimal.from(1.5),
    MINIMUM_COLLATERAL_RATIO: Decimal.from(1.1)
  }
};
/**
 * Total collateral ratio below which recovery mode is triggered.
 *
 * @public
 */
export const CRITICAL_COLLATERAL_RATIO = Decimal.from(1.5);

/**
 * Collateral ratio below which a Trove can be liquidated in normal mode.
 *
 * @public
 */
export const MINIMUM_COLLATERAL_RATIO = Decimal.from(1.1);

/**
 * Amount of KUSD that's reserved for compensating the liquidator of a Trove.
 *
 * @public
 */
export const KUSD_LIQUIDATION_RESERVE = Decimal.from(200);

/**
 * A Trove must always have at least this much debt on top of the
 * {@link KUSD_LIQUIDATION_RESERVE | liquidation reserve}.
 *
 * @remarks
 * Any transaction that would result in a Trove with less net debt than this will be reverted.
 *
 * @public
 */
export const KUSD_MINIMUM_NET_DEBT = Decimal.from(1800);

/**
 * A Trove must always have at least this much debt.
 *
 * @remarks
 * Any transaction that would result in a Trove with less debt than this will be reverted.
 *
 * @public
 */
export const KUSD_MINIMUM_DEBT = KUSD_LIQUIDATION_RESERVE.add(KUSD_MINIMUM_NET_DEBT);

/**
 * Value that the {@link Fees.borrowingRate | borrowing rate} will never decay below.
 *
 * @remarks
 * Note that the borrowing rate can still be lower than this during recovery mode, when it's
 * overridden by zero.
 *
 * @public
 */
export const MINIMUM_BORROWING_RATE = Decimal.from(0.005);

/**
 * Value that the {@link Fees.borrowingRate | borrowing rate} will never exceed.
 *
 * @public
 */
export const MAXIMUM_BORROWING_RATE = Decimal.from(0.05);

/**
 * Value that the {@link Fees.redemptionRate | redemption rate} will never decay below.
 *
 * @public
 */
export const MINIMUM_REDEMPTION_RATE = Decimal.from(0.005);
