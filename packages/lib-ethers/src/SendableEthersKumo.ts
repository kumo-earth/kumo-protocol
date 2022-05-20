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
  implements SendableKumo<EthersTransactionReceipt, EthersTransactionResponse> {
  private _populate: PopulatableEthersKumo;

  constructor(populatable: PopulatableEthersKumo) {
    this._populate = populatable;
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveCreationDetails>> {
    return this._populate
      .openTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.closeTrove} */
  closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .adjustTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.borrowKUSD} */
  borrowKUSD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.borrowKUSD(amount, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.repayKUSD} */
  repayKUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayKUSD(amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.setPrice(price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.liquidate} */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<LiquidationDetails>> {
    return this._populate.liquidate(address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.depositKUSDInStabilityPool} */
  depositKUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositKUSDInStabilityPool(amount, frontendTag, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawKUSDFromStabilityPool} */
  withdrawKUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawKUSDFromStabilityPool(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.sendKUSD} */
  sendKUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.sendKUSD(toAddress, amount, overrides).then(sendTransaction);
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
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<RedemptionDetails>> {
    return this._populate.redeemKUSD(amount, maxRedemptionRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.claimCollateralSurplus} */
  claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.claimCollateralSurplus(overrides).then(sendTransaction);
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

  /** {@inheritDoc @kumodao/lib-base#SendableKumo.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersKumoTransaction<void>> {
    return this._populate.registerFrontend(kickbackRate, overrides).then(sendTransaction);
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
