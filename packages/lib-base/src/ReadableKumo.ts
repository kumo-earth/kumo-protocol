import { Provider } from "@ethersproject/abstract-provider";
import { Decimal } from "./Decimal";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";
import { KUMOStake } from "./KUMOStake";

/**
 * Parameters of the {@link ReadableKumo.(getTroves:2) | getTroves()} function.
 *
 * @public
 */
export interface TroveListingParams {
  /** Number of Troves to retrieve. */
  readonly first: number;

  /** How the Troves should be sorted. */
  readonly sortedBy: "ascendingCollateralRatio" | "descendingCollateralRatio";

  /** Index of the first Trove to retrieve from the sorted list. */
  readonly startingAt?: number;

  /**
   * When set to `true`, the retrieved Troves won't include the liquidation shares received since
   * the last time they were directly modified.
   *
   * @remarks
   * Changes the type of returned Troves to {@link TroveWithPendingRedistribution}.
   */
  readonly beforeRedistribution?: boolean;
}

/**
 * Read the state of the Kumo protocol.
 *
 * @remarks
 * Implemented by {@link @kumodao/lib-ethers#EthersKumo}.
 *
 * @public
 */
export interface ReadableKumo {
  /**
   * Get the total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link @kumodao/lib-base#TroveWithPendingRedistribution}.
   */
  getTotalRedistributed(asset: string): Promise<Trove>;

  /**
   * Get a Trove in its state after the last direct modification.
   *
   * @param asset - Address of the ERC20 Asset
   * @param address - Address that owns the Trove.
   *
   * @remarks
   * The current state of a Trove can be fetched using
   * {@link @kumodao/lib-base#ReadableKumo.getTrove | getTrove()}.
   */
  getTroveBeforeRedistribution(
    asset: string,
    address: string
  ): Promise<TroveWithPendingRedistribution>;

  /**
   * Get the current state of a Trove.
   *
   * @param asset - Address of the ERC20 Asset
   * @param address - Address that owns the Trove.
   */
  getTrove(asset: string, address: string): Promise<UserTrove>;

  /**
   * Get number of Troves that are currently open.
   */
  getNumberOfTroves(asset: string): Promise<number>;

  /**
   * Get the current price of the native currency (e.g. Ether) in USD.
   */
  getPrice(asset: string): Promise<Decimal>;

  /**
   * Get the total amount of collateral and debt in the Kumo system.
   */
  getTotal(asset: string): Promise<Trove>;

  /**
   * Get the current state of a Stability Deposit.
   *
   * @param address - Address that owns the Stability Deposit.
   */
  getStabilityDeposit(asset: string, address: string): Promise<StabilityDeposit>;

  /**
   * Get the remaining KUMO that will be collectively rewarded to stability depositors.
   */
  getRemainingStabilityPoolKUMOReward(): Promise<Decimal>;

  /**
   * Get the total amount of KUSD currently deposited in the Stability Pool.
   */
  getKUSDInStabilityPool(asset: string): Promise<Decimal>;

  /**
   * Get the amount of KUSD held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getKUSDBalance(address: string): Promise<Decimal>;

  /**
   * Get the amount of BCT held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getAssetBalance(address: string, assetType: string, provider: Provider): Promise<Decimal>;

  /**
   * Get the amount of KUMO held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getKUMOBalance(address: string): Promise<Decimal>;

  /**
   * Get the amount of Uniswap ETH/KUSD LP tokens held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getUniTokenBalance(address: string): Promise<Decimal>;

  /**
   * Get the liquidity mining contract's allowance of a holder's Uniswap ETH/KUSD LP tokens.
   *
   * @param address - Address holding the Uniswap ETH/KUSD LP tokens.
   */
  getUniTokenAllowance(address: string): Promise<Decimal>;

  /**
   * Get the remaining KUMO that will be collectively rewarded to liquidity miners.
   */
  getRemainingLiquidityMiningKUMOReward(): Promise<Decimal>;

  /**
   * Get the amount of Uniswap ETH/KUSD LP tokens currently staked by an address in liquidity mining.
   *
   * @param address - Address whose LP stake should be retrieved.
   */
  getLiquidityMiningStake(address: string): Promise<Decimal>;

  /**
   * Get the total amount of Uniswap ETH/KUSD LP tokens currently staked in liquidity mining.
   */
  getTotalStakedUniTokens(): Promise<Decimal>;

  /**
   * Get the amount of KUMO earned by an address through mining liquidity.
   *
   * @param address - Address whose KUMO reward should be retrieved.
   */
  getLiquidityMiningKUMOReward(address: string): Promise<Decimal>;

  /**
   * Get the amount of leftover collateral available for withdrawal by an address.
   *
   * @remarks
   * When a Trove gets liquidated or redeemed, any collateral it has above 110% (in case of
   * liquidation) or 100% collateralization (in case of redemption) gets sent to a pool, where it
   * can be withdrawn from using
   * {@link @kumodao/lib-base#TransactableKumo.claimCollateralSurplus | claimCollateralSurplus()}.
   */
  getCollateralSurplusBalance(asset: string, address: string): Promise<Decimal>;

  /** @internal */
  getTroves(
    asset: string,
    params: TroveListingParams & { beforeRedistribution: true }
  ): Promise<TroveWithPendingRedistribution[]>;

  /**
   * Get a slice from the list of Troves.
   *
   * @param params - Controls how the list is sorted, and where the slice begins and ends.
   * @returns Pairs of owner addresses and their Troves.
   */
  getTroves(asset: string, params: TroveListingParams): Promise<UserTrove[]>;

  /**
   * Get a calculator for current fees.
   */
  getFees(asset: string): Promise<Fees>;

  /**
   * Get the current state of an KUMO Stake.
   *
   * @param address - Address that owns the KUMO Stake.
   */
  getKUMOStake(asset: string, address: string): Promise<KUMOStake>;

  /**
   * Get the total amount of KUMO currently staked.
   */
  getTotalStakedKUMO(): Promise<Decimal>;

  /**
   * Check whether an Test Tokens already transfered or not.
   *
   * @param assetAddress - MockAsset Address.
   */
  getTestTokensTransferState(assetAddress: string, userAddress: string): Promise<boolean>;
}
