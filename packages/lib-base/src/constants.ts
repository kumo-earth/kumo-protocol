import { Decimal } from "./Decimal";

interface ASSET_TOKENS_TYPES<T> {
  [key: string]: T;
}

interface AssetType {
  assetName: string,
  assetAddress: string;
  CRITICAL_COLLATERAL_RATIO: Decimal;
  MINIMUM_COLLATERAL_RATIO: Decimal;
  KUSD_MINTED_CAP: Decimal,
  MIN_NET_DEBT: Decimal
}
/**
 * Assets Types
 */
export const ASSET_TOKENS: ASSET_TOKENS_TYPES<AssetType> = {
  nbc: {
    assetName: "Nature-based Carbon",
    assetAddress: "0xD759cFEd50b427b5ca50F56ac9888159fC640baC",
    CRITICAL_COLLATERAL_RATIO: Decimal.from(1.5),
    MINIMUM_COLLATERAL_RATIO: Decimal.from(1.1),
    KUSD_MINTED_CAP: Decimal.from(15000000),
    MIN_NET_DEBT: Decimal.from(2000)
  },
  csc: {
    assetName: "Cookstove Carbon",
    assetAddress: "0xaf015d45b9916E2615E78484319Ea9bCe1E680f6",
    CRITICAL_COLLATERAL_RATIO: Decimal.from(1.5),
    MINIMUM_COLLATERAL_RATIO: Decimal.from(1.1),
    KUSD_MINTED_CAP: Decimal.from(10000000),
    MIN_NET_DEBT: Decimal.from(2000)
  }
};

export const CORE_TEAM_ACCOUNTS = ['0x31c57298578f7508B5982062cfEc5ec8BD346247', '0x1b1E98f4912aE9014064a70537025EF338e6aD67', '0x2E7108e381e9ACab03aA1B4819aaCB50D2964532']
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
