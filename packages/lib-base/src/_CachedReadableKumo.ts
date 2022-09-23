import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { KUMOStake } from "./KUMOStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { FrontendStatus, ReadableKumo, TroveListingParams } from "./ReadableKumo";

/** @internal */
export type _ReadableKumoWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableKumo]: ReadableKumo[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _KumoReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableKumo]: ReadableKumo[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableKumoWithExtraParams<T extends unknown[]>
  extends _ReadableKumoWithExtraParamsBase<T> {
  getTroves(
    asset: string,
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(asset: string, params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;
}

/** @internal */
export interface _KumoReadCache<T extends unknown[]> extends _KumoReadCacheBase<T> {
  getTroves(
    asset: string,
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): TroveWithPendingRedistribution[] | undefined;

  getTroves(asset: string, params: TroveListingParams, ...extraParams: T): UserTrove[] | undefined;
}

/** @internal */
export class _CachedReadableKumo<T extends unknown[]> implements _ReadableKumoWithExtraParams<T> {
  private _readable: _ReadableKumoWithExtraParams<T>;
  private _cache: _KumoReadCache<T>;

  constructor(readable: _ReadableKumoWithExtraParams<T>, cache: _KumoReadCache<T>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(asset: string, ...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotalRedistributed(asset, ...extraParams) ??
      this._readable.getTotalRedistributed(asset, ...extraParams)
    );
  }

  async getTroveBeforeRedistribution(
    address?: string,
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution> {
    return (
      this._cache.getTroveBeforeRedistribution(address, ...extraParams) ??
      this._readable.getTroveBeforeRedistribution(address, ...extraParams)
    );
  }

  async getTrove(asset: string, address?: string, ...extraParams: T): Promise<UserTrove> {
    const [troveBeforeRedistribution, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, ...extraParams),
      this.getTotalRedistributed(asset, ...extraParams)
    ]);

    return troveBeforeRedistribution.applyRedistribution(totalRedistributed);
  }

  async getNumberOfTroves(asset: string, ...extraParams: T): Promise<number> {
    return (
      this._cache.getNumberOfTroves(asset, ...extraParams) ??
      this._readable.getNumberOfTroves(asset, ...extraParams)
    );
  }

  async getPrice(...extraParams: T): Promise<Decimal> {
    return this._cache.getPrice(...extraParams) ?? this._readable.getPrice(...extraParams);
  }

  async getTotal(asset: string, ...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotal(asset, ...extraParams) ?? this._readable.getTotal(asset, ...extraParams)
    );
  }

  async getStabilityDeposit(
    address?: string,
    ...extraParams: T
  ): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit(address, ...extraParams) ??
      this._readable.getStabilityDeposit(address, ...extraParams)
    );
  }

  async getRemainingStabilityPoolKUMOReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingStabilityPoolKUMOReward(...extraParams) ??
      this._readable.getRemainingStabilityPoolKUMOReward(...extraParams)
    );
  }

  async getKUSDInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getKUSDInStabilityPool(...extraParams) ??
      this._readable.getKUSDInStabilityPool(...extraParams)
    );
  }

  async getKUSDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getKUSDBalance(address, ...extraParams) ??
      this._readable.getKUSDBalance(address, ...extraParams)
    );
  }

  async getKUMOBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getKUMOBalance(address, ...extraParams) ??
      this._readable.getKUMOBalance(address, ...extraParams)
    );
  }

  async getUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getUniTokenBalance(address, ...extraParams) ??
      this._readable.getUniTokenBalance(address, ...extraParams)
    );
  }

  async getUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getUniTokenAllowance(address, ...extraParams) ??
      this._readable.getUniTokenAllowance(address, ...extraParams)
    );
  }

  async getRemainingLiquidityMiningKUMOReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingLiquidityMiningKUMOReward(...extraParams) ??
      this._readable.getRemainingLiquidityMiningKUMOReward(...extraParams)
    );
  }

  async getLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningStake(address, ...extraParams) ??
      this._readable.getLiquidityMiningStake(address, ...extraParams)
    );
  }

  async getTotalStakedUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedUniTokens(...extraParams) ??
      this._readable.getTotalStakedUniTokens(...extraParams)
    );
  }

  async getLiquidityMiningKUMOReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningKUMOReward(address, ...extraParams) ??
      this._readable.getLiquidityMiningKUMOReward(address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance(address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(address, ...extraParams)
    );
  }

  getTroves(
    asset: string,
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(asset: string, params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;

  async getTroves(
    asset: string,
    params: TroveListingParams,
    ...extraParams: T
  ): Promise<UserTrove[]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(asset, ...extraParams),
      this._cache.getTroves(
        asset,
        { beforeRedistribution: true, ...restOfParams },
        ...extraParams
      ) ??
        this._readable.getTroves(
          asset,
          { beforeRedistribution: true, ...restOfParams },
          ...extraParams
        )
    ]);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  async getFees(asset: string, ...extraParams: T): Promise<Fees> {
    return (
      this._cache.getFees(asset, ...extraParams) ?? this._readable.getFees(asset, ...extraParams)
    );
  }

  async getKUMOStake(address?: string, ...extraParams: T): Promise<KUMOStake> {
    return (
      this._cache.getKUMOStake(address, ...extraParams) ??
      this._readable.getKUMOStake(address, ...extraParams)
    );
  }

  async getTotalStakedKUMO(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedKUMO(...extraParams) ??
      this._readable.getTotalStakedKUMO(...extraParams)
    );
  }

  async getFrontendStatus(address?: string, ...extraParams: T): Promise<FrontendStatus> {
    return (
      this._cache.getFrontendStatus(address, ...extraParams) ??
      this._readable.getFrontendStatus(address, ...extraParams)
    );
  }
}
