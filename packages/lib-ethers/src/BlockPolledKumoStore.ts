import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  KumoStoreState,
  KumoStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  KUMOStake,
  KumoStore,
  Fees,
  ASSET_TOKENS,
  Vault
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
  private _isError: boolean;

  constructor(readable: ReadableEthersKumo) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _getProvider(readable.connection);
    this._isError = false;
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
    const { userAddress, provider, addresses : { kusdToken, kumoToken } } = this.connection;
    let asset = AddressZero;

    const vaultState: Vault[] = [];
    const assetTokenKeys = Object.keys(ASSET_TOKENS)
    for await (const assetToken of assetTokenKeys) { 
      const { assetName, assetAddress, KUSD_MINTED_CAP, MIN_NET_DEBT } = ASSET_TOKENS[assetToken];
      asset = assetAddress
      const values = await promiseAllValues({
        blockTimestamp: this._readable._getBlockTimestamp(blockTag),
        _feesFactory: this._readable._getFeesFactory(assetAddress, { blockTag }),
        numberOfTroves: this._readable.getNumberOfTroves(assetAddress, { blockTag }),
        totalRedistributed: this._readable.getTotalRedistributed(assetAddress, { blockTag }),
        total: this._readable.getTotal(assetAddress, { blockTag }),
        kusdInStabilityPool: this._readable.getKUSDInStabilityPool(assetToken, { blockTag }),
        price: this._readable.getPrice(assetAddress, { blockTag }),
        _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution(
          assetAddress,
          {
            blockTag
          }
        ),
        ...(userAddress
          ? {
              accountBalance: this._readable.getAssetBalance(userAddress, assetAddress, provider, {
                blockTag
              }),
              collateralSurplusBalance: this._readable.getCollateralSurplusBalance(
                assetAddress,
                userAddress,
                {
                  blockTag
                }
              ),
              // trove: this._readable.getTrove(assetAddress, userAddress, {
              //   blockTag
              // }),

              troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(
                assetAddress,
                userAddress,
                {
                  blockTag
                }
              ),
              stabilityDeposit: this._readable.getStabilityDeposit(assetToken, userAddress, {
                blockTag
              }),
              kumoStake: this._readable.getKUMOStake(assetAddress, userAddress, { blockTag }),
              testTokensTransfered: this._readable.getTestTokensTransferState(assetAddress, userAddress, { blockTag })
              
            }
          : {
              collateralSurplusBalance: Decimal.ZERO,
              accountBalance: Decimal.ZERO,
              troveBeforeRedistribution: new TroveWithPendingRedistribution(
                AddressZero,
                "nonExistent"
              ),
              stabilityDeposit: new StabilityDeposit(
                Decimal.ZERO,
                Decimal.ZERO,
                Decimal.ZERO,
                Decimal.ZERO
              ),
              kumoStake: new KUMOStake(),
              testTokensTransfered: false
            })
      });
      const {
        _feesFactory,
        blockTimestamp,
        total,
        price,
        troveBeforeRedistribution,
        totalRedistributed,
        _riskiestTroveBeforeRedistribution
      } = values;
      const _feesInNormalMode = _feesFactory(blockTimestamp, false);
      const fees = _feesInNormalMode?._setRecoveryMode(total.collateralRatioIsBelowCritical(price));
      const derivedValues = {
        trove: troveBeforeRedistribution?.applyRedistribution(totalRedistributed),
        fees,
        borrowingRate: fees.borrowingRate(),
        redemptionRate: fees.redemptionRate(),
        haveUndercollateralizedTroves: _riskiestTroveBeforeRedistribution
          ?.applyRedistribution(totalRedistributed)
          ?.collateralRatioIsBelowMinimum(price)
      };
      vaultState.push({
        asset: assetToken,
        assetName,
        assetAddress,
        kusdMintedCap: KUSD_MINTED_CAP,
        minNetDebt: MIN_NET_DEBT,
        _feesInNormalMode,
        ...derivedValues,
        ...values
      });
    }

    const { blockTimestamp, _feesFactory, calculateRemainingKUMO, ...baseState } =
      await promiseAllValues({
        blockTimestamp: this._readable._getBlockTimestamp(blockTag),
        _feesFactory: this._readable._getFeesFactory(asset, { blockTag }),
        calculateRemainingKUMO: this._readable._getRemainingLiquidityMiningKUMORewardCalculator({
          blockTag
        }),

        // price: this._readable.getPrice(asset, { blockTag }),
        // numberOfTroves: this._readable.getNumberOfTroves(asset, { blockTag }),
        // totalRedistributed: this._readable.getTotalRedistributed(asset, { blockTag }),
        // total: this._readable.getTotal(asset, { blockTag }),
        // kusdInStabilityPool: this._readable.getKUSDInStabilityPool({ blockTag }),
        totalStakedKUMO: this._readable.getTotalStakedKUMO({ blockTag }),
        // _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution(asset, {
        //   blockTag
        // }),
        totalStakedUniTokens: this._readable.getTotalStakedUniTokens({ blockTag }),
        remainingStabilityPoolKUMOReward: this._readable.getRemainingStabilityPoolKUMOReward({
          blockTag
        }),

        ...(userAddress
          ? {
              accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
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
              // collateralSurplusBalance: this._readable.getCollateralSurplusBalance(
              //   asset,
              //   userAddress,
              //   {
              //     blockTag
              //   }
              // ),
              // troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(
              //   asset,
              //   userAddress,
              //   {
              //     blockTag
              //   }
              // ),
              // stabilityDeposit: this._readable.getStabilityDeposit("nbc", userAddress, { blockTag }),
              kumoStake: this._readable.getKUMOStake(asset, userAddress, { blockTag }),
              
            }
          : {
              accountBalance: Decimal.ZERO,
              kusdBalance: Decimal.ZERO,
              kumoBalance: Decimal.ZERO,
              uniTokenBalance: Decimal.ZERO,
              uniTokenAllowance: Decimal.ZERO,
              liquidityMiningStake: Decimal.ZERO,
              liquidityMiningKUMOReward: Decimal.ZERO,
              // collateralSurplusBalance: Decimal.ZERO,
              // troveBeforeRedistribution: new TroveWithPendingRedistribution(
              //   AddressZero,
              //   "nonExistent"
              // ),
              // stabilityDeposit: new StabilityDeposit(
              //   Decimal.ZERO,
              //   Decimal.ZERO,
              //   Decimal.ZERO,
              //   Decimal.ZERO,
              //   AddressZero
              // ),
              kumoStake: new KUMOStake()
            })
      });

    return [
      {
        ...baseState,
        kusdToken,
        kumoToken,
        vaults: [...vaultState],
        // _feesInNormalMode: _feesFactory(blockTimestamp, false),
        remainingLiquidityMiningKUMOReward: calculateRemainingKUMO(blockTimestamp)
      },
      {
        blockTag,
        blockTimestamp,
        _feesFactory
      }
    ];
  }

  // /** @internal @override */
  // protected _doStart(): () => void {
  //   this._get()
  //     .then(state => {
  //       if (!this._loaded) {
  //         this._load(...state);
  //       }
  //     })
  //     .catch(error => {
  //       if (!this._isError) {
  //         this._isError = true;
  //       }
  //       console.log(error?.message);
  //     });

  //   const blockListener = async (blockTag: number) => {
  //     if (this.connection.signer || this._isError) {
  //       this._isError = false;
  //       this._get(blockTag)
  //         .then(state => {
  //           if (this._loaded) {
  //             this._update(...state);
  //           } else {
  //             this._load(...state);
  //           }
  //         })
  //         .catch(error => {
  //           console.log(error?.message);
  //         });
  //     }
  //   };

  //   this._provider.on("block", blockListener);

  //   return () => {
  //     this._provider.off("block", blockListener);
  //   };
  // }
  /** @internal @override */
  protected _doStart(): () => void {
    const assetNumbers = Object.keys(ASSET_TOKENS).length;
    this._get().then(state => {
      if ((!this._loaded && state[0].vaults.length === assetNumbers) || this.connection?._isDev) {
        this._load(...state);
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);
      if (this._loaded && state[0].vaults.length === assetNumbers) {
        this._update(...state);
      } else if (state[0].vaults.length === assetNumbers) {
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
