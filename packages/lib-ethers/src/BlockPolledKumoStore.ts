import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  KumoStoreState,
  KumoStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  KUMOStake,
  KumoStore,
  Fees
} from "@kumodao/lib-base";

import { decimalify, promiseAllValues } from "./_utils";
import { ReadableEthersKumo } from "./ReadableEthersKumo";
import { EthersKumoConnection, _getProvider } from "./EthersKumoConnection";
import { EthersCallOverrides, EthersProvider } from "./types";

/**
 * Extra state added to {@link @kumodao/lib-base#KumoStoreState} by
 * {@link BlockPolledKumoStore}.
 *
 * @public
 */
export interface BlockPolledKumoStoreExtraState {
  /**
   * Number of block that the store state was fetched from.
   *
   * @remarks
   * May be undefined when the store state is fetched for the first time.
   */
  blockTag?: number;

  /**
   * Timestamp of latest block (number of seconds since epoch).
   */
  blockTimestamp: number;

  

  /** @internal */
  _feesFactory: (blockTimestamp: number, recoveryMode: boolean) => Fees;
}

/**
 * The type of {@link BlockPolledKumoStore}'s
 * {@link @kumodao/lib-base#KumoStore.state | state}.
 *
 * @public
 */
export type BlockPolledKumoStoreState = KumoStoreState<BlockPolledKumoStoreExtraState>;

/**
 * Ethers-based {@link @kumodao/lib-base#KumoStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledKumoStore extends KumoStore<BlockPolledKumoStoreExtraState> {
  readonly connection: EthersKumoConnection;

  private readonly _readable: ReadableEthersKumo;
  private readonly _provider: EthersProvider;

  constructor(readable: ReadableEthersKumo) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _getProvider(readable.connection);
  }

  private async _getRiskiestTroveBeforeRedistribution(
    asset: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    const riskiestTroves = await this._readable.getTroves(
      asset,
      { first: 1, sortedBy: "ascendingCollateralRatio", beforeRedistribution: true },
      overrides
    );

    if (riskiestTroves.length === 0) {
      return new TroveWithPendingRedistribution(AddressZero, "nonExistent");
    }

    return riskiestTroves[0];
  }

  private async _get(
    blockTag?: number
  ): Promise<[baseState: KumoStoreBaseState, extraState: BlockPolledKumoStoreExtraState]> {
    const { userAddress, frontendTag, provider } = this.connection;

    const { blockTimestamp, _feesFactory, calculateRemainingKUMO, ...baseState } =
      await promiseAllValues({
        blockTimestamp: this._readable._getBlockTimestamp(blockTag),
        _feesFactory: this._readable._getFeesFactory(asset, { blockTag }),
        calculateRemainingKUMO: this._readable._getRemainingLiquidityMiningKUMORewardCalculator({
          blockTag
        }),

        price: this._readable.getPrice({ blockTag }),
        numberOfTroves: this._readable.getNumberOfTroves(asset, { blockTag }),
        totalRedistributed: this._readable.getTotalRedistributed(asset, { blockTag }),
        // ...(() => this._readableAssetHelper()),

        total: this._readable.getTotal(asset, { blockTag }),
        kusdInStabilityPool: this._readable.getKUSDInStabilityPool(asset, { blockTag }),
        totalStakedKUMO: this._readable.getTotalStakedKUMO({ blockTag }),
        _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution(asset, {
          blockTag
        }),
        totalStakedUniTokens: this._readable.getTotalStakedUniTokens({ blockTag }),
        remainingStabilityPoolKUMOReward: this._readable.getRemainingStabilityPoolKUMOReward({
          blockTag
        }),

        frontend: frontendTag
          ? this._readable.getFrontendStatus(frontendTag, { blockTag })
          : { status: "unregistered" as const },

        ...(userAddress
          ? {
              accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
              bctBalance: this._readable.getAssetBalance(userAddress, 'BCT', provider, { blockTag }),
              mco2Balance: this._readable.getAssetBalance(userAddress, 'MCO2', provider, { blockTag }),
              kusdBalance: this._readable.getKUSDBalance(userAddress, { blockTag }),
              kumoBalance: this._readable.getKUMOBalance(userAddress, { blockTag }),
              uniTokenBalance: this._readable.getUniTokenBalance(userAddress, { blockTag }),
              uniTokenAllowance: this._readable.getUniTokenAllowance(userAddress, { blockTag }),
              liquidityMiningStake: this._readable.getLiquidityMiningStake(userAddress, {
                blockTag
              }),
              liquidityMiningKUMOReward: this._readable.getLiquidityMiningKUMOReward(userAddress, {
                blockTag
              }),
              collateralSurplusBalance: this._readable.getCollateralSurplusBalance(
                asset,
                userAddress,
                {
                  blockTag
                }
              ),
              troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(
                asset,
                userAddress,
                {
                  blockTag
                }
              ),
              stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag }),
              kumoStake: this._readable.getKUMOStake(asset, userAddress, { blockTag }),
              ownFrontend: this._readable.getFrontendStatus(userAddress, { blockTag })
            }
          : {
              accountBalance: Decimal.ZERO,
              bctBalance: Decimal.ZERO,
              mco2Balance: Decimal.ZERO,
              kusdBalance: Decimal.ZERO,
              kumoBalance: Decimal.ZERO,
              uniTokenBalance: Decimal.ZERO,
              uniTokenAllowance: Decimal.ZERO,
              liquidityMiningStake: Decimal.ZERO,
              liquidityMiningKUMOReward: Decimal.ZERO,
              collateralSurplusBalance: Decimal.ZERO,
              troveBeforeRedistribution: new TroveWithPendingRedistribution(
                AddressZero,
                "nonExistent"
              ),
              stabilityDeposit: new StabilityDeposit(
                Decimal.ZERO,
                Decimal.ZERO,
                Decimal.ZERO,
                Decimal.ZERO,
                AddressZero
              ),
              kumoStake: new KUMOStake(),
              ownFrontend: { status: "unregistered" as const }
            })
      });

    return [
      {
        ...baseState,
        _feesInNormalMode: _feesFactory(blockTimestamp, false),
        remainingLiquidityMiningKUMOReward: calculateRemainingKUMO(blockTimestamp)
      },
      {
        blockTag,
        blockTimestamp,
        _feesFactory
      }
    ];
  }

  /** @internal @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(...state);
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(...state);
      } else {
        this._load(...state);
      }
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledKumoStoreExtraState,
    stateUpdate: Partial<BlockPolledKumoStoreExtraState>
  ): BlockPolledKumoStoreExtraState {
    return {
      blockTag: stateUpdate.blockTag ?? oldState.blockTag,
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp,
      _feesFactory: stateUpdate._feesFactory ?? oldState._feesFactory
    };
  }
}
