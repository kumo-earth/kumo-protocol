// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./TroveManager.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IKUSDToken.sol";
import "./Interfaces/ITroveRedemptor.sol";
import "./Interfaces/IStabilityPoolFactory.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Dependencies/KumoBase.sol";
import "./Dependencies/TroveManagerModel.sol";

contract TroveRedemptor is KumoBase, ITroveRedemptor {
    TroveManager private troveManager;
    ISortedTroves private sortedTroves;
    IKUSDToken private kusdToken;
    IStabilityPoolFactory private stabilityPoolFactory;
    ICollSurplusPool collSurplusPool;

    modifier onlyTroveManager() {
        require(msg.sender == address(troveManager), "TroveRedemptor: Only TroveManager");
        _;
    }

    function setAddresses(
        address _troveManagerAddress,
        address _sortedTrovesAddress,
        address _stabilityPoolFactoryAddress,
        address _kusdTokenAddress,
        address _collSurplusPoolAddress,
        address _kumoParamsAddress
    ) external onlyOwner {
        troveManager = TroveManager(_troveManagerAddress);
        kumoParams = IKumoParameters(_kumoParamsAddress);
        kusdToken = IKUSDToken(_kusdTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        stabilityPoolFactory = IStabilityPoolFactory(_stabilityPoolFactoryAddress);
    }

    // REDEM COLLATERAL STUFF

    function redeemCollateral(
        address _asset,
        address _caller,
        uint256 _KUSDamount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFeePercentage
    ) external onlyTroveManager {
        RedemptionTotals memory totals;

        // requireValidMaxFeePercentage
        require(
            _maxFeePercentage >= kumoParams.REDEMPTION_FEE_FLOOR(_asset) &&
                _maxFeePercentage <= DECIMAL_PRECISION,
            "TroveManager: Max fee percentage must be between 0.5% and 100%"
        );

        totals.price = kumoParams.priceFeed().fetchPrice(_asset);

        // requireTCRoverMCR
        require(
            _getTCR(_asset, totals.price) >= kumoParams.MCR(_asset),
            "TroveManager: Cannot redeem when TCR < MCR"
        );

        // _requireAmountGreaterThanZero
        require(_KUSDamount > 0, "TroveManager: Amount must be greater than zero");

        _requireKUSDBalanceCoversRedemption(_caller, _KUSDamount);

        totals.totalKUSDSupplyAtStart = getEntireSystemDebt(_asset);
        totals.remainingKUSD = _KUSDamount;
        address currentBorrower;

        if (troveManager.isValidFirstRedemptionHint(_asset, _firstRedemptionHint, totals.price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = sortedTroves.getLast(_asset);
            // Find the first trove with ICR >= MCR
            while (
                currentBorrower != address(0) &&
                troveManager.getCurrentICR(_asset, currentBorrower, totals.price) <
                kumoParams.MCR(_asset)
            ) {
                currentBorrower = sortedTroves.getPrev(_asset, currentBorrower);
            }
        }

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of KUSD is exchanged for collateral
        if (_maxIterations == 0) {
            _maxIterations = type(uint256).max;
        }
        while (currentBorrower != address(0) && totals.remainingKUSD > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = sortedTroves.getPrev(_asset, currentBorrower);

            troveManager.applyPendingRewards(_asset, currentBorrower);

            SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
                _asset,
                currentBorrower,
                totals.remainingKUSD,
                totals.price,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint,
                _partialRedemptionHintNICR
            );

            if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

            totals.totalKUSDToRedeem = totals.totalKUSDToRedeem + (singleRedemption.KUSDLot);
            totals.totalAssetDrawn = totals.totalAssetDrawn + (singleRedemption.AssetLot);

            totals.remainingKUSD = totals.remainingKUSD - (singleRedemption.KUSDLot);
            currentBorrower = nextUserToCheck;
        }
        require(totals.totalAssetDrawn > 0, "TroveManager: Unable to redeem any amount");

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total KUSD supply value, from before it was reduced by the redemption.
        troveManager.updateBaseRateFromRedemption(
            _asset,
            totals.totalAssetDrawn,
            totals.price,
            totals.totalKUSDSupplyAtStart
        );

        // Calculate the ETH fee
        totals.AssetFee = troveManager.getRedemptionFee(_asset, totals.totalAssetDrawn);

        _requireUserAcceptsFee(totals.AssetFee, totals.totalAssetDrawn, _maxFeePercentage);

        troveManager.finalizeRedemption(
            _asset,
            _caller,
            _KUSDamount,
            totals.totalKUSDToRedeem,
            totals.AssetFee,
            totals.totalAssetDrawn
        );
    }

    function _redeemCollateralFromTrove(
        address _asset,
        address _borrower,
        uint256 _maxKUSDamount,
        uint256 _price,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR
    ) internal returns (SingleRedemptionValues memory singleRedemption) {
        LocalVariables_AssetBorrowerPrice memory vars = LocalVariables_AssetBorrowerPrice(
            _asset,
            _borrower,
            _price
        );

        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        singleRedemption.KUSDLot = KumoMath._min(
            _maxKUSDamount,
            (troveManager.getTroveDebt(vars._asset, vars._borrower)) -
                (kumoParams.KUSD_GAS_COMPENSATION(_asset))
        );

        // Get the AssetLot of equivalent value in USD
        singleRedemption.AssetLot = (singleRedemption.KUSDLot * (DECIMAL_PRECISION)) / (_price);

        // Decrease the debt and collateral of the current Trove according to the KUSD lot and corresponding ETH to send
        uint256 newDebt = (troveManager.getTroveDebt(vars._asset, vars._borrower)) -
            (singleRedemption.KUSDLot);
        uint256 newColl = (troveManager.getTroveColl(vars._asset, vars._borrower)) -
            (singleRedemption.AssetLot);

        if (newDebt == kumoParams.KUSD_GAS_COMPENSATION(_asset)) {
            troveManager.executeFullRedemption(vars._asset, vars._borrower, newColl);
        } else {
            uint256 newNICR = KumoMath._computeNominalCR(newColl, newDebt);

            /*
             * If the provided hint is out of date, we bail since trying to reinsert without a good hint will almost
             * certainly result in running out of gas.
             *
             * If the resultant net debt of the partial is less than the minimum, net debt we bail.
             */

            if (
                newNICR != _partialRedemptionHintNICR ||
                _getNetDebt(vars._asset, newDebt) < kumoParams.MIN_NET_DEBT(vars._asset)
            ) {
                singleRedemption.cancelledPartial = true;
                return singleRedemption;
            }

            troveManager.executePartialRedemption(
                vars._asset,
                vars._borrower,
                newDebt,
                newColl,
                newNICR,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint
            );
        }

        return singleRedemption;
    }

    function _requireKUSDBalanceCoversRedemption(address _redeemer, uint256 _amount) internal view {
        require(
            kusdToken.balanceOf(_redeemer) >= _amount,
            "TroveManager: Requested redemption amount must be <= user's KUSD token balance"
        );
    }

    // BATCH LIQUIDATE TROVES STUFF

    function batchLiquidateTroves(
        address _asset,
        address[] memory _troveArray,
        address _caller
    ) external onlyTroveManager {
        IActivePool activePoolCached = kumoParams.activePool();
        IDefaultPool defaultPoolCached = kumoParams.defaultPool();
        IStabilityPool stabilityPoolCached = stabilityPoolFactory.getStabilityPoolByAsset(_asset);

        LocalVariables_OuterLiquidationFunction memory vars;
        LiquidationTotals memory totals;

        vars.price = kumoParams.priceFeed().fetchPrice(_asset);
        vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (vars.recoveryModeAtStart) {
            totals = troveManager.getTotalFromBatchLiquidate_RecoveryMode(
                _asset,
                activePoolCached,
                defaultPoolCached,
                vars.price,
                vars.KUSDInStabPool,
                _troveArray
            );
        } else {
            //  if !vars.recoveryModeAtStart
            totals = troveManager.getTotalsFromBatchLiquidate_NormalMode(
                _asset,
                activePoolCached,
                defaultPoolCached,
                vars.price,
                vars.KUSDInStabPool,
                _troveArray
            );
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and KUSD to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(
            _asset,
            totals.totalDebtToRedistribute,
            totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendAsset(_asset, address(collSurplusPool), totals.totalCollSurplus);
        }

        troveManager.finalizeLiquidateTroves(
            _asset,
            _caller,
            totals.totalCollGasCompensation,
            totals.totalDebtInSequence,
            totals.totalCollInSequence,
            totals.totalCollSurplus,
            totals.totalkusdGasCompensation
        );
    }

    /*
     * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
     * starting from the one with the lowest collateral ratio in the system, and moving upwards
     */
    function liquidateTroves(
        address _asset,
        uint256 _n,
        address _caller
    ) external onlyTroveManager {
        IActivePool activePoolCached = kumoParams.activePool();
        IStabilityPool stabilityPoolCached = stabilityPoolFactory.getStabilityPoolByAsset(_asset);

        LocalVariables_OuterLiquidationFunction memory vars;

        LiquidationTotals memory totals;

        vars.price = kumoParams.priceFeed().fetchPrice(_asset);
        vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

        // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
        if (vars.recoveryModeAtStart) {
            totals = troveManager.getTotalsFromLiquidateTrovesSequence_RecoveryMode(
                _asset,
                vars.price,
                vars.KUSDInStabPool,
                _n
            );
        } else {
            // if !vars.recoveryModeAtStart
            totals = troveManager.getTotalsFromLiquidateTrovesSequence_NormalMode(
                _asset,
                vars.price,
                vars.KUSDInStabPool,
                _n
            );
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and KUSD to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(
            _asset,
            totals.totalDebtToRedistribute,
            totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendAsset(_asset, address(collSurplusPool), totals.totalCollSurplus);
        }

        troveManager.finalizeLiquidateTroves(
            _asset,
            _caller,
            totals.totalCollGasCompensation,
            totals.totalDebtInSequence,
            totals.totalCollInSequence,
            totals.totalCollSurplus,
            totals.totalkusdGasCompensation
        );
    }

    function _redistributeDebtAndColl(
        address _asset,
        uint256 _debt,
        uint256 _coll
    ) internal {
        if (_debt == 0) {
            return;
        }

        /*
         * Add distributed coll and debt rewards-per-unit-staked to the running totals. Division uses a "feedback"
         * error correction, to keep the cumulative error low in the running totals L_ASSETS and L_KUSDDebt:
         *
         * 1) Form numerators which compensate for the floor division errors that occurred the last time this
         * function was called.
         * 2) Calculate "per-unit-staked" ratios.
         * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
         * 4) Store these errors for use in the next correction when this function is called.
         * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
         */
        uint256 ETHNumerator = _coll *
            (DECIMAL_PRECISION) +
            (troveManager.lastAssetError_Redistribution(_asset));
        uint256 KUSDDebtNumerator = _debt *
            (DECIMAL_PRECISION) +
            (troveManager.lastKUSDDebtError_Redistribution(_asset));

        // Get the per-unit-staked terms
        uint256 AssetRewardPerUnitStaked = ETHNumerator / (troveManager.totalStakes(_asset));
        uint256 KUSDDebtRewardPerUnitStaked = KUSDDebtNumerator / (troveManager.totalStakes(_asset));

        troveManager.setRedistributeDebtAndCollVars(
            _asset,
            ETHNumerator - (AssetRewardPerUnitStaked * (troveManager.totalStakes(_asset))),
            KUSDDebtNumerator - (KUSDDebtRewardPerUnitStaked * (troveManager.totalStakes(_asset))),
            AssetRewardPerUnitStaked,
            KUSDDebtRewardPerUnitStaked
        );

        troveManager.finalizeRedistributeDebtAndColl(_asset, _debt, _coll);
    }
}
