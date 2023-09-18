import {
  CollateralGainTransferDetails,
  Decimalish,
  LiquidationDetails,
  RedemptionDetails,
  SendableKumo,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams
} from "@kumodao/lib-base";

import {
  EthersTransactionOverrides,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import {
  BorrowingOperationOptionalParams,
  PopulatableEthersKumo,
  PopulatedEthersKumoTransaction,
  SentEthersKumoTransaction
} from "./PopulatableEthersKumo";

const sendTransaction = <T>(tx: PopulatedEthersKumoTransaction<T>) => tx.send();

/**
 * Ethers-based implementation of {@link @kumodao/lib-base#SendableKumo}.
 *
 * @public
 */
export class SendableEthersKumo
  implements SendableKumo<EthersTransactionReceipt, EthersTransactionResponse>
{
  private _populate: PopulatableEthersKumo;

  constructor(populatable: PopulatableEthersKumo) {
    this._populate = populatable;
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    asset: string,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveCreationDetails>> {
    return this._populate
      .openTrove(params, asset, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.closeTrove} */
  closeTrove(
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(asset, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    asset: string,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .adjustTrove(params, asset, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.depositCollateral} */
  depositCollateral(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(asset, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawCollateral} */
  withdrawCollateral(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(asset, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.borrowKUSD} */
  borrowKUSD(
    asset: string,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .borrowKUSD(asset, amount, maxBorrowingRate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.repayKUSD} */
  repayKUSD(
    asset: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayKUSD(asset, amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    asset: string,
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.setPrice(asset, price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.liquidate} */
  liquidate(
    asset: string,
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<LiquidationDetails>> {
    return this._populate.liquidate(asset, address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.liquidateUpTo} */
  liquidateUpTo(
    asset: string,
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(asset, maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.depositKUSDInStabilityPool} */
  depositKUSDInStabilityPool(
    amount: Decimalish,
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositKUSDInStabilityPool(amount, asset, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawKUSDFromStabilityPool} */
  withdrawKUSDFromStabilityPool(
    amount: Decimalish,
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .withdrawKUSDFromStabilityPool(amount, asset, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(asset, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    asset: string,
    assetName: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(asset, assetName, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.sendKUSD} */
  sendKUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.sendKUSD(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.sendKUSD} */
  requestTestToken(
    tokenAddress: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.requestTestToken(tokenAddress, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.sendKUSD} */
  transferTestTokens(
    tokenAddress: string,
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.transferTestTokens(tokenAddress, toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.sendKUMO} */
  sendKUMO(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.sendKUMO(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.redeemKUSD} */
  redeemKUSD(
    asset: string,
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<RedemptionDetails>> {
    return this._populate
      .redeemKUSD(asset, amount, maxRedemptionRate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.claimCollateralSurplus} */
  claimCollateralSurplus(
    asset: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.claimCollateralSurplus(asset, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.stakeKUMO} */
  stakeKUMO(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.stakeKUMO(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.unstakeKUMO} */
  unstakeKUMO(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.unstakeKUMO(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.withdrawGainsFromStaking(overrides).then(sendTransaction);
  }

  /** @internal */
  _mintUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate._mintUniToken(amount, address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.approveUniTokens(allowance, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.stakeUniTokens} */
  stakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.stakeUniTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.unstakeUniTokens} */
  unstakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.unstakeUniTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawKUMORewardFromLiquidityMining} */
  withdrawKUMORewardFromLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.withdrawKUMORewardFromLiquidityMining(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.exitLiquidityMining} */
  exitLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.exitLiquidityMining(overrides).then(sendTransaction);
  }
}
