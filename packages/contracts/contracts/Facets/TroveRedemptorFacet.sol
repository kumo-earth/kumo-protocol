// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "../Interfaces/Facets/ITroveRedemptorFacet.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Dependencies/KumoMath.sol";
import "hardhat/console.sol";
import {Status, Modifiers, TroveManagerOperation} from "../Libraries/LibAppStorage.sol";
import {LibKumoBase} from "../Libraries/LibKumoBase.sol";
import {LibTroveManager} from "../Libraries/LibTroveManager.sol";
import {LibMeta} from "../Libraries/LibMeta.sol";

contract TroveRedemptorFacet is ITroveRedemptorFacet, Modifiers {
    /*
     * --- Variable container structs for liquidations ---
     *
     * These structs are used to hold, return and assign variables inside the liquidation functions,
     * in order to avoid the error: "CompilerError: Stack too deep".
     **/

    struct LocalVariables_OuterLiquidationFunction {
        uint256 price;
        uint256 KUSDInStabPool;
        bool recoveryModeAtStart;
        uint256 liquidatedDebt;
        uint256 liquidatedColl;
    }

    struct LocalVariables_InnerSingleLiquidateFunction {
        uint256 collToLiquidate;
        uint256 pendingDebtReward;
        uint256 pendingCollReward;
    }

    struct LocalVariables_LiquidationSequence {
        uint256 remainingKUSDInStabPool;
        uint256 i;
        uint256 ICR;
        address user;
        bool backToNormalMode;
        uint256 entireSystemDebt;
        uint256 entireSystemColl;
    }

    struct LocalVariables_AssetBorrowerPrice {
        address _asset;
        address _borrower;
        uint256 _price;
    }

    struct LiquidationValues {
        uint256 entireTroveDebt;
        uint256 entireTroveColl;
        uint256 collGasCompensation;
        uint256 kusdGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
    }

    struct LiquidationTotals {
        uint256 totalCollInSequence;
        uint256 totalDebtInSequence;
        uint256 totalCollGasCompensation;
        uint256 totalkusdGasCompensation;
        uint256 totalDebtToOffset;
        uint256 totalCollToSendToSP;
        uint256 totalDebtToRedistribute;
        uint256 totalCollToRedistribute;
        uint256 totalCollSurplus;
    }

    // --- Variable container structs for redemptions ---

    struct RedemptionTotals {
        uint256 remainingKUSD;
        uint256 totalKUSDToRedeem;
        uint256 totalAssetDrawn;
        uint256 AssetFee;
        uint256 AssetToSendToRedeemer;
        uint256 decayedBaseRate;
        uint256 price;
        uint256 totalKUSDSupplyAtStart;
    }

    struct SingleRedemptionValues {
        uint256 KUSDLot;
        uint256 AssetLot;
        bool cancelledPartial;
    }

    event Redemption(
        address indexed _asset,
        uint256 _attemptedKUSDAmount,
        uint256 _actualKUSDAmount,
        uint256 _AssetSent,
        uint256 _AssetFee
    );
    event TroveUpdated(
        address indexed _asset,
        address indexed _borrower,
        uint256 _debt,
        uint256 _coll,
        uint256 _stake,
        TroveManagerOperation _operation
    );
    event TroveLiquidated(
        address indexed _asset,
        address indexed _borrower,
        uint256 _debt,
        uint256 _coll,
        TroveManagerOperation _operation
    );
    event Liquidation(
        address indexed _asset,
        uint256 _liquidatedDebt,
        uint256 _liquidatedColl,
        uint256 _collGasCompensation,
        uint256 _kusdGasCompensation
    );
    event LTermsUpdated(uint256 _L_ETH, uint256 _L_KUSDDebt);
    event TotalStakesUpdated(address indexed _asset, uint256 _newTotalStakes);
    event SystemSnapshotsUpdated(
        address indexed _asset,
        uint256 _totalStakesSnapshot,
        uint256 _totalCollateralSnapshot
    );

    modifier troveIsActive(address _asset, address _borrower) {
        require(
            LibTroveManager._isTroveActive(_asset, _borrower),
            "TroveManager: Trove does not exist or is closed"
        );
        _;
    }

    function _requireKUSDBalanceCoversRedemption(address _redeemer, uint256 _amount) internal view {
        require(
            s.kusdToken.balanceOf(_redeemer) >= _amount,
            "TroveManager: Requested redemption amount must be <= user's KUSD token balance"
        );
    }

    // --- Trove Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
    function liquidate(address _asset, address _borrower) external troveIsActive(_asset, _borrower) {
        address[] memory borrowers = new address[](1);
        borrowers[0] = _borrower;
        batchLiquidateTroves(_asset, borrowers);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(
        address _asset,
        address _borrower,
        uint256 _KUSDInStabPool
    ) internal returns (LiquidationValues memory singleLiquidation) {
        LocalVariables_InnerSingleLiquidateFunction memory vars;

        (
            singleLiquidation.entireTroveDebt,
            singleLiquidation.entireTroveColl,
            vars.pendingDebtReward,
            vars.pendingCollReward
        ) = LibTroveManager._getEntireDebtAndColl(_asset, _borrower);

        LibTroveManager._movePendingTroveRewardsToActivePool(
            _asset,
            vars.pendingDebtReward,
            vars.pendingCollReward
        );
        LibTroveManager._removeStake(_asset, _borrower);

        singleLiquidation.collGasCompensation = LibKumoBase._getCollGasCompensation(
            _asset,
            singleLiquidation.entireTroveColl
        );
        singleLiquidation.kusdGasCompensation = s.kumoParams.KUSD_GAS_COMPENSATION(_asset);
        uint256 collToLiquidate = singleLiquidation.entireTroveColl -
            singleLiquidation.collGasCompensation;

        (
            singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute
        ) = _getOffsetAndRedistributionVals(
            singleLiquidation.entireTroveDebt,
            collToLiquidate,
            _KUSDInStabPool
        );

        LibTroveManager._closeTrove(_asset, _borrower, Status.closedByLiquidation);
        emit TroveLiquidated(
            _asset,
            _borrower,
            singleLiquidation.entireTroveDebt,
            singleLiquidation.entireTroveColl,
            TroveManagerOperation.liquidateInNormalMode
        );
        emit TroveUpdated(_asset, _borrower, 0, 0, 0, TroveManagerOperation.liquidateInNormalMode);
        return singleLiquidation;
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(
        address _asset,
        address _borrower,
        uint256 _ICR,
        uint256 _KUSDInStabPool,
        uint256 _TCR,
        uint256 _price
    ) internal returns (LiquidationValues memory singleLiquidation) {
        LocalVariables_InnerSingleLiquidateFunction memory vars;
        if (s.TroveOwners[_asset].length <= 1) {
            return singleLiquidation;
        } // don't liquidate if last trove
        (
            singleLiquidation.entireTroveDebt,
            singleLiquidation.entireTroveColl,
            vars.pendingDebtReward,
            vars.pendingCollReward
        ) = LibTroveManager._getEntireDebtAndColl(_asset, _borrower);

        singleLiquidation.collGasCompensation = LibKumoBase._getCollGasCompensation(
            _asset,
            singleLiquidation.entireTroveColl
        );
        singleLiquidation.kusdGasCompensation = s.kumoParams.KUSD_GAS_COMPENSATION(_asset);
        vars.collToLiquidate =
            singleLiquidation.entireTroveColl -
            singleLiquidation.collGasCompensation;

        // If ICR <= 100%, purely redistribute the Trove across all active Troves
        if (_ICR <= s.kumoParams._100pct()) {
            LibTroveManager._movePendingTroveRewardsToActivePool(
                _asset,
                vars.pendingDebtReward,
                vars.pendingCollReward
            );
            LibTroveManager._removeStake(_asset, _borrower);

            singleLiquidation.debtToOffset = 0;
            singleLiquidation.collToSendToSP = 0;
            singleLiquidation.debtToRedistribute = singleLiquidation.entireTroveDebt;
            singleLiquidation.collToRedistribute = vars.collToLiquidate;

            LibTroveManager._closeTrove(_asset, _borrower, Status.closedByLiquidation);
            emit TroveLiquidated(
                _asset,
                _borrower,
                singleLiquidation.entireTroveDebt,
                singleLiquidation.entireTroveColl,
                TroveManagerOperation.liquidateInRecoveryMode
            );
            emit TroveUpdated(
                _asset,
                _borrower,
                0,
                0,
                0,
                TroveManagerOperation.liquidateInRecoveryMode
            );

            // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > s.kumoParams._100pct()) && (_ICR < s.kumoParams.MCR(_asset))) {
            LibTroveManager._movePendingTroveRewardsToActivePool(
                _asset,
                vars.pendingDebtReward,
                vars.pendingCollReward
            );
            LibTroveManager._removeStake(_asset, _borrower);

            (
                singleLiquidation.debtToOffset,
                singleLiquidation.collToSendToSP,
                singleLiquidation.debtToRedistribute,
                singleLiquidation.collToRedistribute
            ) = _getOffsetAndRedistributionVals(
                singleLiquidation.entireTroveDebt,
                vars.collToLiquidate,
                _KUSDInStabPool
            );

            LibTroveManager._closeTrove(_asset, _borrower, Status.closedByLiquidation);
            emit TroveLiquidated(
                _asset,
                _borrower,
                singleLiquidation.entireTroveDebt,
                singleLiquidation.entireTroveColl,
                TroveManagerOperation.liquidateInRecoveryMode
            );
            emit TroveUpdated(
                _asset,
                _borrower,
                0,
                0,
                0,
                TroveManagerOperation.liquidateInRecoveryMode
            );
            /*
             * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
             * and there is KUSD in the Stability Pool, only offset, with no redistribution,
             * but at a capped rate of 1.1 and only if the whole debt can be liquidated.
             * The remainder due to the capped rate will be claimable as collateral surplus.
             */
        } else if (
            (_ICR >= s.kumoParams.MCR(_asset)) &&
            (_ICR < _TCR) &&
            (singleLiquidation.entireTroveDebt <= _KUSDInStabPool)
        ) {
            LibTroveManager._movePendingTroveRewardsToActivePool(
                _asset,
                vars.pendingDebtReward,
                vars.pendingCollReward
            );
            assert(_KUSDInStabPool != 0);

            LibTroveManager._removeStake(_asset, _borrower);
            singleLiquidation = _getCappedOffsetVals(
                _asset,
                singleLiquidation.entireTroveDebt,
                singleLiquidation.entireTroveColl,
                _price
            );

            LibTroveManager._closeTrove(_asset, _borrower, Status.closedByLiquidation);
            if (singleLiquidation.collSurplus > 0) {
                s.collSurplusPool.accountSurplus(_asset, _borrower, singleLiquidation.collSurplus);
            }

            emit TroveLiquidated(
                _asset,
                _borrower,
                singleLiquidation.entireTroveDebt,
                singleLiquidation.collToSendToSP,
                TroveManagerOperation.liquidateInRecoveryMode
            );
            emit TroveUpdated(
                _asset,
                _borrower,
                0,
                0,
                0,
                TroveManagerOperation.liquidateInRecoveryMode
            );
        } else {
            // if (_ICR >= MCR && ( _ICR >= _TCR || singleLiquidation.entireTroveDebt > _KUSDInStabPool))
            LiquidationValues memory zeroVals;
            return zeroVals;
        }

        return singleLiquidation;
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
     * redistributed to active troves.
     */
    function _getOffsetAndRedistributionVals(
        uint256 _debt,
        uint256 _coll,
        uint256 _KUSDInStabPool
    )
        internal
        pure
        returns (
            uint256 debtToOffset,
            uint256 collToSendToSP,
            uint256 debtToRedistribute,
            uint256 collToRedistribute
        )
    {
        if (_KUSDInStabPool > 0) {
            /*
             * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
             * between all active troves.
             *
             *  If the trove's debt is larger than the deposited KUSD in the Stability Pool:
             *
             *  - Offset an amount of the trove's debt equal to the KUSD in the Stability Pool
             *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
             *
             */
            debtToOffset = KumoMath._min(_debt, _KUSDInStabPool);
            collToSendToSP = (_coll * debtToOffset) / _debt;
            debtToRedistribute = _debt - debtToOffset;
            collToRedistribute = _coll - collToSendToSP;
        } else {
            debtToOffset = 0;
            collToSendToSP = 0;
            debtToRedistribute = _debt;
            collToRedistribute = _coll;
        }
    }

    /*
     *  Get its offset coll/debt and Asset gas comp, and close the trove.
     */
    function _getCappedOffsetVals(
        address _asset,
        uint256 _entireTroveDebt,
        uint256 _entireTroveColl,
        uint256 _price
    ) internal view returns (LiquidationValues memory singleLiquidation) {
        singleLiquidation.entireTroveDebt = _entireTroveDebt;
        singleLiquidation.entireTroveColl = _entireTroveColl;
        uint256 cappedCollPortion = (_entireTroveDebt * s.kumoParams.MCR(_asset)) / _price;

        singleLiquidation.collGasCompensation = LibKumoBase._getCollGasCompensation(
            _asset,
            cappedCollPortion
        );
        singleLiquidation.kusdGasCompensation = s.kumoParams.KUSD_GAS_COMPENSATION(_asset);

        singleLiquidation.debtToOffset = _entireTroveDebt;
        singleLiquidation.collToSendToSP = cappedCollPortion - singleLiquidation.collGasCompensation;
        singleLiquidation.collSurplus = _entireTroveColl - cappedCollPortion;
        singleLiquidation.debtToRedistribute = 0;
        singleLiquidation.collToRedistribute = 0;
    }

    /*
     * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
     * starting from the one with the lowest collateral ratio in the system, and moving upwards
     */
    function liquidateTroves(address _asset, uint256 _n) external {
        IStabilityPool stabilityPoolCached = s.stabilityPoolFactory.getStabilityPoolByAsset(_asset);

        LocalVariables_OuterLiquidationFunction memory vars;

        LiquidationTotals memory totals;

        vars.price = s.kumoParams.priceFeed().fetchPrice(_asset);
        vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
        vars.recoveryModeAtStart = LibKumoBase._checkRecoveryMode(_asset, vars.price);

        // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
        if (vars.recoveryModeAtStart) {
            totals = _getTotalsFromLiquidateTrovesSequence_RecoveryMode(
                _asset,
                vars.price,
                vars.KUSDInStabPool,
                _n
            );
        } else {
            // if !vars.recoveryModeAtStart
            totals = _getTotalsFromLiquidateTrovesSequence_NormalMode(
                _asset,
                vars.price,
                vars.KUSDInStabPool,
                _n
            );
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated Asset and KUSD to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(
            _asset,
            totals.totalDebtToRedistribute,
            totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            s.activePool.sendAsset(_asset, address(s.collSurplusPool), totals.totalCollSurplus);
        }

        _updateSystemSnapshots_excludeCollRemainder(_asset, totals.totalCollGasCompensation);

        emit Liquidation(
            _asset,
            totals.totalDebtInSequence,
            totals.totalCollInSequence - totals.totalCollGasCompensation - totals.totalCollSurplus,
            totals.totalCollGasCompensation,
            totals.totalkusdGasCompensation
        );

        // Send gas compensation to caller
        _sendGasCompensation(
            _asset,
            LibMeta.msgSender(),
            totals.totalkusdGasCompensation,
            totals.totalCollGasCompensation
        );
    }

    /*
     * This function is used when the liquidateTroves sequence starts during Recovery Mode. However, it
     * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
     */
    function _getTotalsFromLiquidateTrovesSequence_RecoveryMode(
        address _asset,
        uint256 _price,
        uint256 _KUSDInStabPool,
        uint256 _n
    ) internal returns (LiquidationTotals memory totals) {
        LocalVariables_AssetBorrowerPrice memory assetVars = LocalVariables_AssetBorrowerPrice(
            _asset,
            address(0),
            _price
        );
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = LibKumoBase._getEntireSystemDebt(assetVars._asset);
        vars.entireSystemColl = LibKumoBase._getEntireSystemColl(assetVars._asset);

        vars.user = s.sortedTroves.getLast(assetVars._asset);
        address firstUser = s.sortedTroves.getFirst(assetVars._asset);
        for (vars.i = 0; vars.i < _n && vars.user != firstUser; vars.i++) {
            // we need to cache it, because current user is likely going to be deleted
            address nextUser = s.sortedTroves.getPrev(assetVars._asset, vars.user);

            vars.ICR = LibTroveManager._getCurrentICR(assetVars._asset, vars.user, _price);

            if (!vars.backToNormalMode) {
                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= s.kumoParams.MCR(_asset) && vars.remainingKUSDInStabPool == 0) {
                    break;
                }

                uint256 TCR = KumoMath._computeCR(
                    vars.entireSystemColl,
                    vars.entireSystemDebt,
                    _price
                );
                singleLiquidation = _liquidateRecoveryMode(
                    assetVars._asset,
                    vars.user,
                    vars.ICR,
                    vars.remainingKUSDInStabPool,
                    TCR,
                    assetVars._price
                );

                // Update aggregate trackers
                vars.remainingKUSDInStabPool =
                    vars.remainingKUSDInStabPool -
                    singleLiquidation.debtToOffset;
                vars.entireSystemDebt = vars.entireSystemDebt - singleLiquidation.debtToOffset;
                vars.entireSystemColl =
                    vars.entireSystemColl -
                    singleLiquidation.collToSendToSP -
                    singleLiquidation.collGasCompensation -
                    singleLiquidation.collSurplus;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(
                    _asset,
                    vars.entireSystemColl,
                    vars.entireSystemDebt,
                    _price
                );
            } else if (vars.backToNormalMode && vars.ICR < s.kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(
                    assetVars._asset,
                    vars.user,
                    vars.remainingKUSDInStabPool
                );

                vars.remainingKUSDInStabPool =
                    vars.remainingKUSDInStabPool -
                    singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            } else break; // break if the loop reaches a Trove with ICR >= MCR

            vars.user = nextUser;
        }
    }

    function _getTotalsFromLiquidateTrovesSequence_NormalMode(
        address _asset,
        uint256 _price,
        uint256 _KUSDInStabPool,
        uint256 _n
    ) internal returns (LiquidationTotals memory totals) {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;

        for (vars.i = 0; vars.i < _n; vars.i++) {
            vars.user = s.sortedTroves.getLast(_asset);
            vars.ICR = LibTroveManager._getCurrentICR(_asset, vars.user, _price);

            if (vars.ICR < s.kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(
                    _asset,
                    vars.user,
                    vars.remainingKUSDInStabPool
                );

                vars.remainingKUSDInStabPool =
                    vars.remainingKUSDInStabPool -
                    singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            } else break; // break if the loop reaches a Trove with ICR >= MCR
        }
    }

    /*
     * Attempt to liquidate a custom list of troves provided by the caller.
     */
    function batchLiquidateTroves(address _asset, address[] memory _troveArray) public {
        require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

        IStabilityPool stabilityPoolCached = s.stabilityPoolFactory.getStabilityPoolByAsset(_asset);

        LocalVariables_OuterLiquidationFunction memory vars;
        LiquidationTotals memory totals;

        vars.price = s.kumoParams.priceFeed().fetchPrice(_asset);
        vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
        vars.recoveryModeAtStart = LibKumoBase._checkRecoveryMode(_asset, vars.price);

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (vars.recoveryModeAtStart) {
            totals = _getTotalFromBatchLiquidate_RecoveryMode(
                _asset,
                vars.price,
                vars.KUSDInStabPool,
                _troveArray
            );
        } else {
            //  if !vars.recoveryModeAtStart
            totals = _getTotalsFromBatchLiquidate_NormalMode(
                _asset,
                vars.price,
                vars.KUSDInStabPool,
                _troveArray
            );
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated Asset and KUSD to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(
            _asset,
            totals.totalDebtToRedistribute,
            totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            s.activePool.sendAsset(_asset, address(s.collSurplusPool), totals.totalCollSurplus);
        }

        _updateSystemSnapshots_excludeCollRemainder(_asset, totals.totalCollGasCompensation);

        emit Liquidation(
            _asset,
            totals.totalDebtInSequence,
            totals.totalCollInSequence - totals.totalCollGasCompensation - totals.totalCollSurplus,
            totals.totalCollGasCompensation,
            totals.totalkusdGasCompensation
        );

        // Send gas compensation to caller
        _sendGasCompensation(
            _asset,
            LibMeta.msgSender(),
            totals.totalkusdGasCompensation,
            totals.totalCollGasCompensation
        );
    }

    /*
     * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
     * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
     */
    function _getTotalFromBatchLiquidate_RecoveryMode(
        address _asset,
        uint256 _price,
        uint256 _KUSDInStabPool,
        address[] memory _troveArray
    ) internal returns (LiquidationTotals memory totals) {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = LibKumoBase._getEntireSystemDebt(_asset);
        vars.entireSystemColl = LibKumoBase._getEntireSystemColl(_asset);

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.user = _troveArray[vars.i];
            // Skip non-active troves
            if (s.Troves[_asset][vars.user].status != Status.active) {
                continue;
            }
            vars.ICR = LibTroveManager._getCurrentICR(_asset, vars.user, _price);

            if (!vars.backToNormalMode) {
                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= s.kumoParams.MCR(_asset) && vars.remainingKUSDInStabPool == 0) {
                    continue;
                }

                uint256 TCR = KumoMath._computeCR(
                    vars.entireSystemColl,
                    vars.entireSystemDebt,
                    _price
                );

                singleLiquidation = _liquidateRecoveryMode(
                    _asset,
                    vars.user,
                    vars.ICR,
                    vars.remainingKUSDInStabPool,
                    TCR,
                    _price
                );

                // Update aggregate trackers
                vars.remainingKUSDInStabPool =
                    vars.remainingKUSDInStabPool -
                    singleLiquidation.debtToOffset;
                vars.entireSystemDebt = vars.entireSystemDebt - singleLiquidation.debtToOffset;
                vars.entireSystemColl =
                    vars.entireSystemColl -
                    singleLiquidation.collToSendToSP -
                    singleLiquidation.collGasCompensation -
                    singleLiquidation.collSurplus;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(
                    _asset,
                    vars.entireSystemColl,
                    vars.entireSystemDebt,
                    _price
                );
            } else if (vars.backToNormalMode && vars.ICR < s.kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(
                    _asset,
                    vars.user,
                    vars.remainingKUSDInStabPool
                );
                vars.remainingKUSDInStabPool =
                    vars.remainingKUSDInStabPool -
                    singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            } else continue; // In Normal Mode skip troves with ICR >= MCR
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode(
        address _asset,
        uint256 _price,
        uint256 _KUSDInStabPool,
        address[] memory _troveArray
    ) internal returns (LiquidationTotals memory totals) {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.user = _troveArray[vars.i];
            vars.ICR = LibTroveManager._getCurrentICR(_asset, vars.user, _price);

            if (vars.ICR < s.kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(
                    _asset,
                    vars.user,
                    vars.remainingKUSDInStabPool
                );
                vars.remainingKUSDInStabPool =
                    vars.remainingKUSDInStabPool -
                    singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(
        LiquidationTotals memory oldTotals,
        LiquidationValues memory singleLiquidation
    ) internal pure returns (LiquidationTotals memory newTotals) {
        // Tally all the values with their respective running totals
        newTotals.totalCollGasCompensation =
            oldTotals.totalCollGasCompensation +
            singleLiquidation.collGasCompensation;
        newTotals.totalkusdGasCompensation =
            oldTotals.totalkusdGasCompensation +
            singleLiquidation.kusdGasCompensation;
        newTotals.totalDebtInSequence =
            oldTotals.totalDebtInSequence +
            singleLiquidation.entireTroveDebt;
        newTotals.totalCollInSequence =
            oldTotals.totalCollInSequence +
            singleLiquidation.entireTroveColl;
        newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset + singleLiquidation.debtToOffset;
        newTotals.totalCollToSendToSP =
            oldTotals.totalCollToSendToSP +
            singleLiquidation.collToSendToSP;
        newTotals.totalDebtToRedistribute =
            oldTotals.totalDebtToRedistribute +
            singleLiquidation.debtToRedistribute;
        newTotals.totalCollToRedistribute =
            oldTotals.totalCollToRedistribute +
            singleLiquidation.collToRedistribute;
        newTotals.totalCollSurplus = oldTotals.totalCollSurplus + singleLiquidation.collSurplus;

        return newTotals;
    }

    function _sendGasCompensation(
        address _asset,
        address _liquidator,
        uint256 _KUSD,
        uint256 _amount
    ) internal {
        // Before calling this function, we always check that something was liquidated, otherwise revert.
        // KUSD gas compensation could then only be zero if we set to zero that constant, but it’s ok to have this here as a sanity check
        if (_KUSD > 0) {
            s.kusdToken.returnFromPool(s.gasPoolAddress, _liquidator, _KUSD);
        }

        // Asset gas compensation could only be zero if all liquidated troves in the sequence had collateral lower than 200 Wei
        // (see LibKumoBase._getCollGasCompensation function in KumoBase)
        // With the current values of min debt this seems quite unlikely, unless Asset price was in the order of magnitude of $10^19 or more,
        // but it’s ok to have this here as a sanity check

        if (_amount > 0) {
            s.activePool.sendAsset(_asset, _liquidator, _amount);
        }
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's Trove in exchange for KUSD up to _maxKUSDamount
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
            s.Troves[vars._asset][_borrower].debt - s.kumoParams.KUSD_GAS_COMPENSATION(_asset)
        );

        // Get the ETHLot of equivalent value in USD
        singleRedemption.AssetLot = (singleRedemption.KUSDLot * KumoMath.DECIMAL_PRECISION) / _price;

        // Decrease the debt and collateral of the current Trove according to the KUSD lot and corresponding Asset to send
        uint256 newDebt = s.Troves[vars._asset][vars._borrower].debt - singleRedemption.KUSDLot;
        uint256 newColl = s.Troves[vars._asset][vars._borrower].coll - singleRedemption.AssetLot;

        if (newDebt == s.kumoParams.KUSD_GAS_COMPENSATION(vars._asset)) {
            // No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
            LibTroveManager._removeStake(vars._asset, vars._borrower);
            LibTroveManager._closeTrove(vars._asset, vars._borrower, Status.closedByRedemption);
            _redeemCloseTrove(
                vars._asset,
                vars._borrower,
                s.kumoParams.KUSD_GAS_COMPENSATION(vars._asset),
                newColl
            );
            emit TroveUpdated(
                vars._asset,
                vars._borrower,
                0,
                0,
                0,
                TroveManagerOperation.redeemCollateral
            );
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
                LibKumoBase._getNetDebt(vars._asset, newDebt) <
                s.kumoParams.MIN_NET_DEBT(vars._asset)
            ) {
                singleRedemption.cancelledPartial = true;
                return singleRedemption;
            }

            s.sortedTroves.reInsert(
                vars._asset,
                vars._borrower,
                newNICR,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint
            );

            s.Troves[vars._asset][vars._borrower].debt = newDebt;
            s.Troves[vars._asset][vars._borrower].coll = newColl;
            _updateStakeAndTotalStakes(vars._asset, vars._borrower);

            emit TroveUpdated(
                vars._asset,
                vars._borrower,
                newDebt,
                newColl,
                s.Troves[vars._asset][vars._borrower].stake,
                TroveManagerOperation.redeemCollateral
            );
        }

        return singleRedemption;
    }

    /*
     * Called when a full redemption occurs, and closes the trove.
     * The redeemer swaps (debt - liquidation reserve) KUSD for (debt - liquidation reserve) worth of Asset, so the KUSD liquidation reserve left corresponds to the remaining debt.
     * In order to close the trove, the KUSD liquidation reserve is burned, and the corresponding debt is removed from the active pool.
     * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
     * Any surplus Asset left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
     */
    function _redeemCloseTrove(
        address _asset,
        address _borrower,
        uint256 _KUSD,
        uint256 _amount
    ) internal {
        s.kusdToken.burn(s.gasPoolAddress, _KUSD);
        // Update Active Pool KUSD, and send Asset to account
        s.activePool.decreaseKUSDDebt(_asset, _KUSD);

        // send Asset from Active Pool to CollSurplus Pool
        s.collSurplusPool.accountSurplus(_asset, _borrower, _amount);
        s.activePool.sendAsset(_asset, address(s.collSurplusPool), _amount);
    }

    function _isValidFirstRedemptionHint(
        address _asset,
        address _firstRedemptionHint,
        uint256 _price
    ) internal view returns (bool) {
        if (
            _firstRedemptionHint == address(0) ||
            !s.sortedTroves.contains(_asset, _firstRedemptionHint) ||
            LibTroveManager._getCurrentICR(_asset, _firstRedemptionHint, _price) <
            s.kumoParams.MCR(_asset)
        ) {
            return false;
        }

        address nextTrove = s.sortedTroves.getNext(_asset, _firstRedemptionHint);
        return
            nextTrove == address(0) ||
            LibTroveManager._getCurrentICR(_asset, nextTrove, _price) < s.kumoParams.MCR(_asset);
    }

    // --- Redemption functions ---

    /* Send _KUSDamount KUSD to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
     * request.  Applies pending rewards to a Trove before reducing its debt and coll.
     *
     * Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by
     * splitting the total _amount in appropriate chunks and calling the function multiple times.
     *
     * Param `_maxIterations` can also be provided, so the loop through Troves is capped (if it’s zero, it will be ignored).This makes it easier to
     * avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology”
     * of the trove list. It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode
     * costs can vary.
     *
     * All Troves that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed.
     * If the last Trove does have some remaining debt, it has a finite ICR, and the reinsertion could be anywhere in the list, therefore it requires a hint.
     * A frontend should use getRedemptionHints() to calculate what the ICR of this Trove will be after redemption, and pass a hint for its position
     * in the sortedTroves list along with the ICR value that the hint was found for.
     *
     * If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
     * is very likely that the last (partially) redeemed Trove would end up with a different ICR than what the hint is for. In this case the
     * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining KUSD amount, which they can attempt
     * to redeem later.
     */

    function redeemCollateral(
        address _asset,
        uint256 _KUSDamount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFeePercentage
    ) external {
        RedemptionTotals memory totals;

        _requireAfterBootstrapPeriod();
        _requireValidMaxFeePercentage(_asset, _maxFeePercentage);

        totals.price = s.kumoParams.priceFeed().fetchPrice(_asset);

        _requireTCRoverMCR(_asset, totals.price);

        _requireAmountGreaterThanZero(_KUSDamount);

        _requireKUSDBalanceCoversRedemption(LibMeta.msgSender(), _KUSDamount);

        totals.totalKUSDSupplyAtStart = LibKumoBase._getEntireSystemDebt(_asset);

        // Confirm redeemer's balance is less than total KUSD supply
        assert(s.kusdToken.balanceOf(LibMeta.msgSender()) <= totals.totalKUSDSupplyAtStart);

        totals.remainingKUSD = _KUSDamount;
        address currentBorrower;

        if (_isValidFirstRedemptionHint(_asset, _firstRedemptionHint, totals.price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = s.sortedTroves.getLast(_asset);
            // Find the first trove with ICR >= MCR
            while (
                currentBorrower != address(0) &&
                LibTroveManager._getCurrentICR(_asset, currentBorrower, totals.price) <
                s.kumoParams.MCR(_asset)
            ) {
                currentBorrower = s.sortedTroves.getPrev(_asset, currentBorrower);
            }
        }

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of KUSD is exchanged for collateral
        if (_maxIterations == 0) {
            _maxIterations = type(uint256).max;
        }
        while (currentBorrower != address(0) && totals.remainingKUSD > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = s.sortedTroves.getPrev(_asset, currentBorrower);

            _applyPendingRewards(_asset, currentBorrower);

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
        _updateBaseRateFromRedemption(
            totals.totalAssetDrawn,
            totals.price,
            totals.totalKUSDSupplyAtStart
        );

        // Calculate the Asset fee
        totals.AssetFee = LibTroveManager._getRedemptionFee(_asset, totals.totalAssetDrawn);

        LibKumoBase._requireUserAcceptsFee(
            totals.AssetFee,
            totals.totalAssetDrawn,
            _maxFeePercentage
        );

        // Send the fee to Stability Pool providers
        s.activePool.sendAsset(
            _asset,
            address(s.stabilityPoolFactory.getStabilityPoolByAsset(_asset)),
            totals.AssetFee
        );
        s.stabilityPoolFactory.getStabilityPoolByAsset(_asset).increaseF_Asset(totals.AssetFee);

        totals.AssetToSendToRedeemer = totals.totalAssetDrawn - totals.AssetFee;

        emit Redemption(
            _asset,
            _KUSDamount,
            totals.totalKUSDToRedeem,
            totals.totalAssetDrawn,
            totals.AssetFee
        );

        // Burn the total KUSD that is cancelled with debt, and send the redeemed Asset to msg.sender
        s.kusdToken.burn(LibMeta.msgSender(), totals.totalKUSDToRedeem);
        // Update Active Pool KUSD, and send Asset to account
        s.activePool.decreaseKUSDDebt(_asset, totals.totalKUSDToRedeem);
        s.activePool.sendAsset(_asset, LibMeta.msgSender(), totals.AssetToSendToRedeemer);
    }

    function _redistributeDebtAndColl(address _asset, uint256 _debt, uint256 _coll) internal {
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
        uint256 AssetNumerator = _coll *
            KumoMath.DECIMAL_PRECISION +
            s.lastAssetError_Redistribution[_asset];
        uint256 KUSDDebtNumerator = _debt *
            KumoMath.DECIMAL_PRECISION +
            s.lastKUSDDebtError_Redistribution[_asset];

        // Get the per-unit-staked terms
        uint256 AssetRewardPerUnitStaked = AssetNumerator / s.totalStakes[_asset];
        uint256 KUSDDebtRewardPerUnitStaked = KUSDDebtNumerator / s.totalStakes[_asset];

        uint256 _lastAssetError = AssetNumerator -
            (AssetRewardPerUnitStaked * (s.totalStakes[_asset]));
        uint256 _lastKUSDDebtError = KUSDDebtNumerator -
            (KUSDDebtRewardPerUnitStaked * (s.totalStakes[_asset]));

        s.lastAssetError_Redistribution[_asset] = _lastAssetError;
        s.lastKUSDDebtError_Redistribution[_asset] = _lastKUSDDebtError;
        s.L_ASSETS[_asset] = s.L_ASSETS[_asset] + AssetRewardPerUnitStaked;
        s.L_KUSDDebts[_asset] = s.L_KUSDDebts[_asset] + KUSDDebtRewardPerUnitStaked;

        emit LTermsUpdated(s.L_ASSETS[_asset], s.L_KUSDDebts[_asset]);

        // Transfer coll and debt from ActivePool to DefaultPool
        s.activePool.decreaseKUSDDebt(_asset, _debt);
        s.defaultPool.increaseKUSDDebt(_asset, _debt);
        s.activePool.sendAsset(_asset, address(s.defaultPool), _coll);
    }

    function hasPendingRewards(address _asset, address _borrower) public view returns (bool) {
        /*
         * A Trove has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
         * this indicates that rewards have occured since the snapshot was made, and the user therefore has
         * pending rewards
         */
        if (!LibTroveManager._isTroveActive(_asset, _borrower)) {
            return false;
        }

        return (s.rewardSnapshots[_asset][_borrower].asset < s.L_ASSETS[_asset]);
    }

    function applyPendingRewards(address _asset, address _borrower) external {
        _requireCallerIsBorrowerOperations();

        return _applyPendingRewards(_asset, _borrower);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _applyPendingRewards(address _asset, address _borrower) internal {
        if (hasPendingRewards(_asset, _borrower)) {
            _requireTroveIsActive(_asset, _borrower);
            // Compute pending rewards
            uint256 pendingReward = LibTroveManager._getPendingReward(_asset, _borrower);
            uint256 pendingKUSDDebtReward = LibTroveManager._getPendingKUSDDebtReward(
                _asset,
                _borrower
            );

            // Apply pending rewards to trove's state
            s.Troves[_asset][_borrower].coll = s.Troves[_asset][_borrower].coll + pendingReward;
            s.Troves[_asset][_borrower].debt =
                s.Troves[_asset][_borrower].debt +
                pendingKUSDDebtReward;

            LibTroveManager._updateTroveRewardSnapshots(_asset, _borrower);

            // Transfer from DefaultPool to ActivePool
            LibTroveManager._movePendingTroveRewardsToActivePool(
                _asset,
                pendingKUSDDebtReward,
                pendingReward
            );

            emit TroveUpdated(
                _asset,
                _borrower,
                s.Troves[_asset][_borrower].debt,
                s.Troves[_asset][_borrower].coll,
                s.Troves[_asset][_borrower].stake,
                TroveManagerOperation.applyPendingRewards
            );
        }
    }

    function _requireTroveIsActive(address _asset, address _borrower) internal view {
        require(
            s.Troves[_asset][_borrower].status == Status.active,
            "TroveManager: Trove does not exist or is closed"
        );
    }

    // Update borrower's snapshots of s.L_ASSETS and L_KUSDDebt to reflect the current values
    function updateTroveRewardSnapshots(address _asset, address _borrower) external {
        _requireCallerIsBorrowerOperations();
        return LibTroveManager._updateTroveRewardSnapshots(_asset, _borrower);
    }

    /*
     * This function has two impacts on the baseRate state variable:
     * 1) decays the baseRate based on time passed since last redemption or KUSD borrowing operation.
     * then,
     * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
     */
    function _updateBaseRateFromRedemption(
        uint256 _amountDrawn,
        uint256 _price,
        uint256 _totalKUSDSupply
    ) internal returns (uint256) {
        uint256 decayedBaseRate = LibTroveManager._calcDecayedBaseRate();

        /* Convert the drawn Asset back to KUSD at face value rate (1 KUSD:1 USD), in order to get
         * the fraction of total supply that was redeemed at face value. */
        uint256 redeemedKUSDFraction = (_amountDrawn * _price) / _totalKUSDSupply;

        uint256 newBaseRate = decayedBaseRate + (redeemedKUSDFraction / LibTroveManager.BETA);
        newBaseRate = KumoMath._min(newBaseRate, KumoMath.DECIMAL_PRECISION); // cap baseRate at a maximum of 100%
        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in the line above
        assert(newBaseRate > 0); // Base rate is always non-zero after redemption

        // Update the baseRate state variable
        s.baseRate = newBaseRate;
        emit LibTroveManager.BaseRateUpdated(newBaseRate);

        LibTroveManager._updateLastFeeOpTime();

        return newBaseRate;
    }

    function updateStakeAndTotalStakes(
        address _asset,
        address _borrower
    ) external returns (uint256) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_asset, _borrower);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(
        address _asset,
        address _borrower
    ) internal returns (uint256) {
        uint256 newStake = _computeNewStake(_asset, s.Troves[_asset][_borrower].coll);
        uint256 oldStake = s.Troves[_asset][_borrower].stake;
        s.Troves[_asset][_borrower].stake = newStake;

        s.totalStakes[_asset] = s.totalStakes[_asset] - oldStake + newStake;
        emit TotalStakesUpdated(_asset, s.totalStakes[_asset]);

        return newStake;
    }

    // Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
    function _computeNewStake(address _asset, uint256 _coll) internal view returns (uint256) {
        uint256 stake;
        if (s.totalCollateralSnapshot[_asset] == 0) {
            stake = _coll;
        } else {
            /*
             * The following assert() holds true because:
             * - The system always contains >= 1 trove
             * - When we close or liquidate a trove, we redistribute the pending rewards, so if all troves were closed/liquidated,
             * rewards would’ve been emptied and totalCollateralSnapshot would be zero too.
             */
            assert(s.totalStakesSnapshot[_asset] > 0);
            stake = (_coll * s.totalStakesSnapshot[_asset]) / s.totalCollateralSnapshot[_asset];
        }
        return stake;
    }

    // Check whether or not the system *would be* in Recovery Mode, given an Asset:USD price, and the entire system coll and debt.
    function _checkPotentialRecoveryMode(
        address _asset,
        uint256 _entireSystemColl,
        uint256 _entireSystemDebt,
        uint256 _price
    ) internal view returns (bool) {
        uint256 TCR = KumoMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);

        return TCR < s.kumoParams.CCR(_asset);
    }

    /*
     * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
     * Used in a liquidation sequence.
     *
     * The calculation excludes a portion of collateral that is in the ActivePool:
     *
     * the total Asset gas compensation from the liquidation sequence
     *
     * The Asset as compensation must be excluded as it is always sent out at the very end of the liquidation sequence.
     */
    function _updateSystemSnapshots_excludeCollRemainder(
        address _asset,
        uint256 _collRemainder
    ) internal {
        s.totalStakesSnapshot[_asset] = s.totalStakes[_asset];

        uint256 activeColl = s.activePool.getAssetBalance(_asset);
        uint256 liquidatedColl = s.defaultPool.getAssetBalance(_asset);
        s.totalCollateralSnapshot[_asset] = activeColl - _collRemainder + liquidatedColl;

        emit SystemSnapshotsUpdated(
            _asset,
            s.totalStakesSnapshot[_asset],
            s.totalCollateralSnapshot[_asset]
        );
    }

    function _requireAfterBootstrapPeriod() internal view {
        uint256 systemDeploymentTime = s.kusdToken.getDeploymentStartTime();
        require(
            block.timestamp >= systemDeploymentTime + s.kumoParams.BOOTSTRAP_PERIOD(),
            "TroveManager: Redemptions are not allowed during bootstrap phase"
        );
    }

    function _requireValidMaxFeePercentage(address _asset, uint256 _maxFeePercentage) internal view {
        require(
            _maxFeePercentage >= s.kumoParams.REDEMPTION_FEE_FLOOR(_asset) &&
                _maxFeePercentage <= KumoMath.DECIMAL_PRECISION,
            "TroveManager: Max fee percentage must be between 0.5% and 100%"
        );
    }

    function _requireTCRoverMCR(address _asset, uint256 _price) internal view {
        require(
            LibKumoBase._getTCR(_asset, _price) >= s.kumoParams.MCR(_asset),
            "TroveManager: Cannot redeem when TCR < MCR"
        );
    }

    function _requireAmountGreaterThanZero(uint256 _KUSDamount) internal pure {
        require(_KUSDamount > 0, "TroveManager: Amount must be greater than zero");
    }
}
