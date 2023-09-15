import { ethers } from "ethers";

import iERC20Abi from "../abi/IERC20.json";

import { BlockTag } from "@ethersproject/abstract-provider";

import {
  Decimal,
  Fees,
  KumoStore,
  KUMOStake,
  ReadableKumo,
  StabilityDeposit,
  Trove,
  TroveListingParams,
  TroveWithPendingRedistribution,
  UserTrove,
  UserTroveStatus
} from "@kumodao/lib-base";

import { MultiTroveGetter } from "../types";

import { decimalify, numberify, panic } from "./_utils";
import { EthersCallOverrides, EthersProvider, EthersSigner } from "./types";

import {
  EthersKumoConnection,
  EthersKumoConnectionOptionalParams,
  EthersKumoStoreOption,
  _connect,
  _getBlockTimestamp,
  _getContracts,
  _requireAddress,
  _getStabilityPoolByAsset
} from "./EthersKumoConnection";

import { BlockPolledKumoStore } from "./BlockPolledKumoStore";

// TODO: these are constant in the contracts, so it doesn't make sense to make a call for them,
// but to avoid having to update them here when we change them in the contracts, we could read
// them once after deployment and save them to KumoDeployment.
const MINUTE_DECAY_FACTOR = Decimal.from("0.999037758833783000");
const BETA = Decimal.from(2);

enum BackendTroveStatus {
  nonExistent,
  active,
  closedByOwner,
  closedByLiquidation,
  closedByRedemption
}

const userTroveStatusFrom = (backendStatus: BackendTroveStatus): UserTroveStatus =>
  backendStatus === BackendTroveStatus.nonExistent
    ? "nonExistent"
    : backendStatus === BackendTroveStatus.active
      ? "open"
      : backendStatus === BackendTroveStatus.closedByOwner
        ? "closedByOwner"
        : backendStatus === BackendTroveStatus.closedByLiquidation
          ? "closedByLiquidation"
          : backendStatus === BackendTroveStatus.closedByRedemption
            ? "closedByRedemption"
            : panic(new Error(`invalid backendStatus ${backendStatus}`));

const convertToDate = (timestamp: number) => new Date(timestamp * 1000);

const validSortingOptions = ["ascendingCollateralRatio", "descendingCollateralRatio"];

const expectPositiveInt = <K extends string>(obj: { [P in K]?: number }, key: K) => {
  if (obj[key] !== undefined) {
    if (!Number.isInteger(obj[key])) {
      throw new Error(`${key} must be an integer`);
    }

    if (obj[key] < 0) {
      throw new Error(`${key} must not be negative`);
    }
  }
};

/**
 * Ethers-based implementation of {@link @kumodao/lib-base#ReadableKumo}.
 *
 * @public
 */
export class ReadableEthersKumo implements ReadableKumo {
  readonly connection: EthersKumoConnection;

  /** @internal */
  constructor(connection: EthersKumoConnection) {
    this.connection = connection;
  }

  /** @internal */
  static _from(
    connection: EthersKumoConnection & { useStore: "blockPolled" }
  ): ReadableEthersKumoWithStore<BlockPolledKumoStore>;

  /** @internal */
  static _from(connection: EthersKumoConnection): ReadableEthersKumo;

  /** @internal */
  static _from(connection: EthersKumoConnection): ReadableEthersKumo {
    const readable = new ReadableEthersKumo(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableEthersKumo(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersKumoConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<ReadableEthersKumoWithStore<BlockPolledKumoStore>>;

  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersKumoConnectionOptionalParams
  ): Promise<ReadableEthersKumo>;

  /**
   * Connect to the Kumo protocol and create a `ReadableEthersKumo` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersKumoConnectionOptionalParams
  ): Promise<ReadableEthersKumo> {
    return ReadableEthersKumo._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `ReadableEthersKumo` is a {@link ReadableEthersKumoWithStore}.
   */
  hasStore(): this is ReadableEthersKumoWithStore;

  /**
   * Check whether this `ReadableEthersKumo` is a
   * {@link ReadableEthersKumoWithStore}\<{@link BlockPolledKumoStore}\>.
   */
  hasStore(store: "blockPolled"): this is ReadableEthersKumoWithStore<BlockPolledKumoStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotalRedistributed} */
  async getTotalRedistributed(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    const { troveManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      troveManager.L_ASSETS(asset, { ...overrides }).then(decimalify),
      troveManager.L_KUSDDebts(asset, { ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTroveBeforeRedistribution} */
  async getTroveBeforeRedistribution(
    asset: string,
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    address ??= _requireAddress(this.connection);
    const { troveManager } = _getContracts(this.connection);

    const [trove, snapshot] = await Promise.all([
      troveManager.Troves(asset, address, { ...overrides }),
      troveManager.rewardSnapshots(asset, address, { ...overrides })
    ]);

    if (trove.status === BackendTroveStatus.active) {
      return new TroveWithPendingRedistribution(
        address,
        userTroveStatusFrom(trove.status),
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(snapshot.asset), decimalify(snapshot.KUSDDebt))
      );
    } else {
      return new TroveWithPendingRedistribution(address, userTroveStatusFrom(trove.status));
    }
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTrove} */
  async getTrove(
    asset: string,
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove> {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(asset, address, overrides),
      this.getTotalRedistributed(asset, overrides)
    ]);

    return trove.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getNumberOfTroves} */
  async getNumberOfTroves(asset: string, overrides?: EthersCallOverrides): Promise<number> {
    const { troveManager } = _getContracts(this.connection);
    return (await troveManager.getTroveOwnersCount(asset, { ...overrides })).toNumber();
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getPrice} */
  getPrice(asset: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);
    return priceFeed.callStatic.fetchPrice(asset, { ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getActivePool(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    const { activePool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt] = await Promise.all(
      [
        activePool.getAssetBalance(asset, { ...overrides }),
        activePool.getKUSDDebt(asset, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(activeCollateral, activeDebt);
  }

  /** @internal */
  async _getDefaultPool(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    const { defaultPool } = _getContracts(this.connection);

    const [liquidatedCollateral, closedDebt] = await Promise.all(
      [
        defaultPool.getAssetBalance(asset, { ...overrides }),
        defaultPool.getKUSDDebt(asset, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(liquidatedCollateral, closedDebt);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotal} */
  async getTotal(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    const [activePool, defaultPool] = await Promise.all([
      this._getActivePool(asset, overrides),
      this._getDefaultPool(asset, overrides)
    ]);

    return activePool.add(defaultPool);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getStabilityDeposit} */
  async getStabilityDeposit(
    assetName: string,
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const stabilityPool = _getStabilityPoolByAsset(assetName, this.connection);
    // const { stabilityPool } = _getContracts(this.connection);
    const [initialValue, currentKUSD, collateralGain, kumoReward] =
      await Promise.all([
        stabilityPool.deposits(address, { ...overrides }),
        stabilityPool.getCompoundedKUSDDeposit(address, { ...overrides }),
        stabilityPool.getDepositorAssetGain(address, { ...overrides }),
        stabilityPool.getDepositorKUMOGain(address, { ...overrides })
      ]);

    return new StabilityDeposit(
      decimalify(initialValue),
      decimalify(currentKUSD),
      decimalify(collateralGain),
      decimalify(kumoReward)
    );
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getRemainingStabilityPoolKUMOReward} */
  async getRemainingStabilityPoolKUMOReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { communityIssuance } = _getContracts(this.connection);

    const issuanceCap = this.connection.totalStabilityPoolKUMOReward;
    const totalKUMOIssued = decimalify(await communityIssuance.totalKUMOIssued({ ...overrides }));

    // totalKUMOIssued approaches but never reaches issuanceCap
    return issuanceCap.sub(totalKUMOIssued);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUSDInStabilityPool} */
  async getKUSDInStabilityPool(assetName: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    const stabilityPool = _getStabilityPoolByAsset(assetName, this.connection);
    return stabilityPool.getTotalKUSDDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUSDBalance} */
  getKUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { kusdToken } = _getContracts(this.connection);

    return kusdToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  getAssetBalance(
    address: string,
    asset: string,
    provider: EthersProvider,
    overrides?: EthersCallOverrides
  ) {
    address ??= _requireAddress(this.connection);

    const assetTokenContract = new ethers.Contract(asset, iERC20Abi, provider);
    return assetTokenContract.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUMOBalance} */
  getKUMOBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { kumoToken } = _getContracts(this.connection);

    return kumoToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getUniTokenBalance} */
  getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { uniToken } = _getContracts(this.connection);

    return uniToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getUniTokenAllowance} */
  getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { uniToken, unipool } = _getContracts(this.connection);

    return uniToken.allowance(address, unipool.address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getRemainingLiquidityMiningKUMORewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    const { unipool } = _getContracts(this.connection);

    const [totalSupply, rewardRate, periodFinish, lastUpdateTime] = await Promise.all([
      unipool.totalSupply({ ...overrides }),
      unipool.rewardRate({ ...overrides }).then(decimalify),
      unipool.periodFinish({ ...overrides }).then(numberify),
      unipool.lastUpdateTime({ ...overrides }).then(numberify)
    ]);

    return (blockTimestamp: number) =>
      rewardRate.mul(
        Math.max(0, periodFinish - (totalSupply.isZero() ? lastUpdateTime : blockTimestamp))
      );
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getRemainingLiquidityMiningKUMOReward} */
  async getRemainingLiquidityMiningKUMOReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const [calculateRemainingKUMO, blockTimestamp] = await Promise.all([
      this._getRemainingLiquidityMiningKUMORewardCalculator(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return calculateRemainingKUMO(blockTimestamp);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getLiquidityMiningStake} */
  getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { unipool } = _getContracts(this.connection);

    return unipool.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotalStakedUniTokens} */
  getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { unipool } = _getContracts(this.connection);

    return unipool.totalSupply({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getLiquidityMiningKUMOReward} */
  getLiquidityMiningKUMOReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { unipool } = _getContracts(this.connection);

    return unipool.earned(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(
    asset: string,
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);
    return collSurplusPool.getCollateral(asset, address, { ...overrides }).then(decimalify);
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

  async getTroves(
    asset: string,
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove[]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions.map(x => `"${x}"`).join(", ")}`
      );
    }

    const [totalRedistributed, backendTroves] = await Promise.all([
      params.beforeRedistribution ? undefined : this.getTotalRedistributed(asset, { ...overrides }),
      multiTroveGetter.getMultipleSortedTroves(
        asset,
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      )
    ]);

    const troves = mapBackendTroves(backendTroves);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  /** @internal */
  _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return _getBlockTimestamp(this.connection, blockTag);
  }

  /** @internal */
  async _getFeesFactory(
    asset: string,
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    const { troveManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      troveManager.lastFeeOperationTime({ ...overrides }),
      troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    return (blockTimestamp, recoveryMode) =>
      new Fees(
        baseRateWithoutDecay,
        MINUTE_DECAY_FACTOR,
        BETA,
        convertToDate(lastFeeOperationTime.toNumber()),
        convertToDate(blockTimestamp),
        recoveryMode
      );
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getFees} */
  async getFees(asset: string, overrides?: EthersCallOverrides): Promise<Fees> {
    const [createFees, total, price, blockTimestamp] = await Promise.all([
      this._getFeesFactory(asset, overrides),
      this.getTotal(asset, overrides),
      this.getPrice(asset, overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return createFees(blockTimestamp, total.collateralRatioIsBelowCritical(price));
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getKUMOStake} */
  async getKUMOStake(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<KUMOStake> {
    address ??= _requireAddress(this.connection);
    const { kumoStaking } = _getContracts(this.connection);

    const [stakedKUMO, collateralGain, kusdGain] = await Promise.all(
      [
        kumoStaking.stakes(address, { ...overrides }),
        kumoStaking.getPendingAssetGain(asset, address, { ...overrides }),
        kumoStaking.getPendingKUSDGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new KUMOStake(stakedKUMO, collateralGain, kusdGain);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTotalStakedKUMO} */
  async getTotalStakedKUMO(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { kumoStaking } = _getContracts(this.connection);

    return kumoStaking.totalKUMOStaked({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @kumodao/lib-base#ReadableKumo.getTestTokensTransferState} */
  async getTestTokensTransferState(
    assetAddress: string,
    userAddress: string,
    overrides?: EthersCallOverrides
  ): Promise<boolean> {
    userAddress ??= _requireAddress(this.connection);
    const { kumoFaucet } = _getContracts(this.connection);

    return kumoFaucet.getTestTokensTransferState(assetAddress, userAddress, { ...overrides })
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type BackendTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapBackendTroves = (troves: BackendTroves): TroveWithPendingRedistribution[] =>
  troves.map(
    trove =>
      new TroveWithPendingRedistribution(
        trove.owner,
        "open", // These Troves are coming from the SortedTroves list, so they must be open
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(trove.snapshotAsset), decimalify(trove.snapshotKUSDDebt))
      )
  );

/**
 * Variant of {@link ReadableEthersKumo} that exposes a {@link @kumodao/lib-base#KumoStore}.
 *
 * @public
 */
export interface ReadableEthersKumoWithStore<T extends KumoStore = KumoStore>
  extends ReadableEthersKumo {
  /** An object that implements KumoStore. */
  readonly store: T;
}

class _BlockPolledReadableEthersKumo implements ReadableEthersKumoWithStore<BlockPolledKumoStore> {
  readonly connection: EthersKumoConnection;
  readonly store: BlockPolledKumoStore;

  private readonly _readable: ReadableEthersKumo;

  constructor(readable: ReadableEthersKumo) {
    const store = new BlockPolledKumoStore(readable);

    this.store = store;
    this.connection = readable.connection;
    this._readable = readable;
  }

  private _blockHit(overrides?: EthersCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this.store.state.blockTag
    );
  }

  private _userHit(address: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this.store.connection.userAddress)
    );
  }

  hasStore(store?: EthersKumoStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }

  async getTotalRedistributed(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._blockHit(overrides) && vault)
      ? vault.totalRedistributed
      : this._readable.getTotalRedistributed(asset, overrides);
  }

  async getTroveBeforeRedistribution(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._userHit(address, overrides) && vault)
      ? vault.troveBeforeRedistribution
      : this._readable.getTroveBeforeRedistribution(asset, address, overrides);
  }

  async getTrove(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._userHit(address, overrides) && vault)
      ? vault.trove
      : this._readable.getTrove(asset, address, overrides);
  }

  async getNumberOfTroves(asset: string, overrides?: EthersCallOverrides): Promise<number> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._blockHit(overrides) && vault)
      ? vault.numberOfTroves
      : this._readable.getNumberOfTroves(asset, overrides);
  }

  async getPrice(asset: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._blockHit(overrides) && vault)
      ? vault.price
      : this._readable.getPrice(asset, overrides);
  }

  async getTotal(asset: string, overrides?: EthersCallOverrides): Promise<Trove> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._blockHit(overrides) && vault)
      ? vault.total
      : this._readable.getTotal(asset, overrides);
  }

  async getStabilityDeposit(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    const vault = this.store.state.vaults.find(vault => vault.asset === asset);
    return (this._userHit(address, overrides) && vault)
      ? vault.stabilityDeposit
      : this._readable.getStabilityDeposit(asset, address, overrides);
  }

  async getRemainingStabilityPoolKUMOReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingStabilityPoolKUMOReward
      : this._readable.getRemainingStabilityPoolKUMOReward(overrides);
  }

  async getKUSDInStabilityPool(asset: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    const vault = this.store.state.vaults.find(vault => vault.asset === asset);
    return (this._blockHit(overrides) && vault)
      ? vault.kusdInStabilityPool
      : this._readable.getKUSDInStabilityPool(asset, overrides);
  }

  async getKUSDBalance(address: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.kusdBalance
      : this._readable.getKUSDBalance(address, overrides);
  }
  async getAssetBalance(
    address: string,
    assetType: string,
    provider: EthersProvider,
    overrides?: EthersCallOverrides
  ) {
    if (this._userHit(address, overrides)) {
      const vault = this.store.state.vaults.find(vault => vault.asset === assetType);
      if (vault) {
        return vault?.accountBalance;
      }
    } else {
      this._readable.getAssetBalance(address, assetType, provider, overrides);
    }
  }

  async getKUMOBalance(address: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.kumoBalance
      : this._readable.getKUMOBalance(address, overrides);
  }

  async getUniTokenBalance(address: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.uniTokenBalance
      : this._readable.getUniTokenBalance(address, overrides);
  }

  async getUniTokenAllowance(address: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.uniTokenAllowance
      : this._readable.getUniTokenAllowance(address, overrides);
  }

  async getRemainingLiquidityMiningKUMOReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingLiquidityMiningKUMOReward
      : this._readable.getRemainingLiquidityMiningKUMOReward(overrides);
  }

  async getLiquidityMiningStake(address: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.liquidityMiningStake
      : this._readable.getLiquidityMiningStake(address, overrides);
  }

  async getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedUniTokens
      : this._readable.getTotalStakedUniTokens(overrides);
  }

  async getLiquidityMiningKUMOReward(
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.liquidityMiningKUMOReward
      : this._readable.getLiquidityMiningKUMOReward(address, overrides);
  }

  async getCollateralSurplusBalance(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._userHit(address, overrides) && vault)
      ? vault.collateralSurplusBalance
      : this._readable.getCollateralSurplusBalance(asset, address, overrides);
  }

  async _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return this._blockHit({ blockTag })
      ? this.store.state.blockTimestamp
      : this._readable._getBlockTimestamp(blockTag);
  }

  async _getFeesFactory(
    asset: string,
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._blockHit(overrides)
      ? this.store.state._feesFactory
      : this._readable._getFeesFactory(asset, overrides);
  }

  async getFees(asset: string, overrides?: EthersCallOverrides): Promise<Fees> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === asset);
    return (this._blockHit(overrides) && vault)
      ? vault.fees
      : this._readable.getFees(asset, overrides);
  }

  async getKUMOStake(
    asset: string,
    address: string,
    overrides?: EthersCallOverrides
  ): Promise<KUMOStake> {
    return this._userHit(address, overrides)
      ? this.store.state.kumoStake
      : this._readable.getKUMOStake(asset, address, overrides);
  }

  async getTotalStakedKUMO(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedKUMO
      : this._readable.getTotalStakedKUMO(overrides);
  }

  async getTestTokensTransferState(
    assetAddress: string,
    userAddress: string,
    overrides?: EthersCallOverrides
  ): Promise<boolean> {
    const vault = this.store.state.vaults.find(vault => vault.assetAddress === assetAddress);
    return (this._blockHit(overrides) && vault)
      ? vault.testTokensTransfered
      : this._readable.getTestTokensTransferState(assetAddress, userAddress, overrides);
  }

  getTroves(
    asset: string,
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

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

  _getActivePool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getDefaultPool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getRemainingLiquidityMiningKUMORewardCalculator(): Promise<(blockTimestamp: number) => Decimal> {
    throw new Error("Method not implemented.");
  }
}
