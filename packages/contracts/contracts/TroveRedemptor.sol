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
    using SafeMath for uint256;

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
    ) external {
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
    ) external override onlyTroveManager {
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

            totals.totalKUSDToRedeem = totals.totalKUSDToRedeem.add(singleRedemption.KUSDLot);
            totals.totalAssetDrawn = totals.totalAssetDrawn.add(singleRedemption.AssetLot);

            totals.remainingKUSD = totals.remainingKUSD.sub(singleRedemption.KUSDLot);
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
            (troveManager.getTroveDebt(vars._asset, vars._borrower)).sub(
                kumoParams.KUSD_GAS_COMPENSATION(_asset)
            )
        );

        // Get the AssetLot of equivalent value in USD
        singleRedemption.AssetLot = singleRedemption.KUSDLot.mul(DECIMAL_PRECISION).div(_price);

        // Decrease the debt and collateral of the current Trove according to the KUSD lot and corresponding ETH to send
        uint256 newDebt = (troveManager.getTroveDebt(vars._asset, vars._borrower)).sub(
            singleRedemption.KUSDLot
        );
        uint256 newColl = (troveManager.getTroveColl(vars._asset, vars._borrower)).sub(
            singleRedemption.AssetLot
        );

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

    function batchLiquidateTroves(address _asset, address[] memory _troveArray) external {
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
        troveManager.redistributeDebtAndColl(
            _asset,
            activePoolCached,
            defaultPoolCached,
            totals.totalDebtToRedistribute,
            totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendAsset(_asset, address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        troveManager.updateSystemSnapshots_excludeCollRemainder(
            _asset,
            totals.totalCollGasCompensation
        );

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence.sub(totals.totalCollGasCompensation).sub(
            totals.totalCollSurplus
        );
        emit Liquidation(
            _asset,
            vars.liquidatedDebt,
            vars.liquidatedColl,
            totals.totalCollGasCompensation,
            totals.totalkusdGasCompensation
        );

        // Send gas compensation to caller
        troveManager.sendGasCompensation(
            _asset,
            activePoolCached,
            msg.sender,
            totals.totalkusdGasCompensation,
            totals.totalCollGasCompensation
        );
    }

    /*
     * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
     * starting from the one with the lowest collateral ratio in the system, and moving upwards
     */
    // function liquidateTroves(address _asset, uint256 _n) external override {
    //     ContractsCache memory contractsCache = ContractsCache(
    //         kumoParams.activePool(),
    //         kumoParams.defaultPool(),
    //         IKUSDToken(address(0)),
    //         IKUMOStaking(address(0)),
    //         sortedTroves,
    //         ICollSurplusPool(address(0)),
    //         address(0)
    //     );
    //     IStabilityPool stabilityPoolCached = stabilityPoolFactory.getStabilityPoolByAsset(_asset);

    //     LocalVariables_OuterLiquidationFunction memory vars;

    //     LiquidationTotals memory totals;

    //     vars.price = kumoParams.priceFeed().fetchPrice(_asset);
    //     vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
    //     vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

    //     // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
    //     if (vars.recoveryModeAtStart) {
    //         totals = _getTotalsFromLiquidateTrovesSequence_RecoveryMode(
    //             _asset,
    //             contractsCache,
    //             vars.price,
    //             vars.KUSDInStabPool,
    //             _n
    //         );
    //     } else {
    //         // if !vars.recoveryModeAtStart
    //         totals = _getTotalsFromLiquidateTrovesSequence_NormalMode(
    //             _asset,
    //             contractsCache.activePool,
    //             contractsCache.defaultPool,
    //             vars.price,
    //             vars.KUSDInStabPool,
    //             _n
    //         );
    //     }

    //     require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

    //     // Move liquidated ETH and KUSD to the appropriate pools
    //     stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
    //     _redistributeDebtAndColl(
    //         _asset,
    //         contractsCache.activePool,
    //         contractsCache.defaultPool,
    //         totals.totalDebtToRedistribute,
    //         totals.totalCollToRedistribute
    //     );
    //     if (totals.totalCollSurplus > 0) {
    //         contractsCache.activePool.sendAsset(
    //             _asset,
    //             address(collSurplusPool),
    //             totals.totalCollSurplus
    //         );
    //     }

    //     // Update system snapshots
    //     _updateSystemSnapshots_excludeCollRemainder(_asset, totals.totalCollGasCompensation);

    //     vars.liquidatedDebt = totals.totalDebtInSequence;
    //     vars.liquidatedColl = totals.totalCollInSequence.sub(totals.totalCollGasCompensation).sub(
    //         totals.totalCollSurplus
    //     );
    //     emit Liquidation(
    //         _asset,
    //         vars.liquidatedDebt,
    //         vars.liquidatedColl,
    //         totals.totalCollGasCompensation,
    //         totals.totalkusdGasCompensation
    //     );

    //     // Send gas compensation to caller
    //     _sendGasCompensation(
    //         _asset,
    //         contractsCache.activePool,
    //         msg.sender,
    //         totals.totalkusdGasCompensation,
    //         totals.totalCollGasCompensation
    //     );
    // }

    /*
     * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
     * Used in a liquidation sequence.
     *
     * The calculation excludes a portion of collateral that is in the ActivePool:
     *
     * the total ETH gas compensation from the liquidation sequence
     *
     * The ETH as compensation must be excluded as it is always sent out at the very end of the liquidation sequence.
     */
    // function updateSystemSnapshots_excludeCollRemainder(address _asset, uint256 _collRemainder)
    //     external
    // {
    //     troveManager.setTotalStakesSnapshot(_asset, troveManager.totalStakes(_asset));

    //     uint256 activeColl = kumoParams.activePool().getAssetBalance(_asset);
    //     uint256 liquidatedColl = kumoParams.defaultPool().getAssetBalance(_asset);
    //     troveManager.setTotalCollateralSnapshot(
    //         _asset,
    //         activeColl.sub(_collRemainder).add(liquidatedColl)
    //     );

    //     emit SystemSnapshotsUpdated(
    //         _asset,
    //         troveManager.totalStakesSnapshot(_asset),
    //         troveManager.totalCollateralSnapshot(_asset)
    //     );
    // }
}
