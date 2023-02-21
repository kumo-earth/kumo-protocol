// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import {LibAppStorage, AppStorage, Status} from "./LibAppStorage.sol";
import {LibKumoBase} from "./LibKumoBase.sol";
import "../Dependencies/KumoMath.sol";

library LibTroveManager {
    uint256 public constant SECONDS_IN_ONE_MINUTE = 60;
    /*
     * Half-life of 12h. 12h = 720 min
     * (1/2) = d^720 => d = (1/2)^(1/720)
     */
    uint256 public constant MINUTE_DECAY_FACTOR = 999037758833783000;
    /*
     * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
     * Corresponds to (1 / ALPHA) in the white paper.
     */
    uint256 public constant BETA = 2;

    // Events
    event TroveSnapshotsUpdated(address indexed _asset, uint256 _L_ETH, uint256 _L_KUSDDebt);
    event BaseRateUpdated(address indexed _asset, uint256 _baseRate);
    event LastFeeOpTimeUpdated(address indexed _asset, uint256 _lastFeeOpTime);
    event TroveIndexUpdated(address indexed _asset, address _borrower, uint256 _newIndex);

    function _getCurrentICR(
        address _asset,
        address _borrower,
        uint256 _price
    ) internal view returns (uint256) {
        (uint256 currentAsset, uint256 currentKUSDDebt) = _getCurrentTroveAmounts(_asset, _borrower);

        uint256 ICR = KumoMath._computeCR(currentAsset, currentKUSDDebt, _price);
        return ICR;
    }

    function _getCurrentTroveAmounts(address _asset, address _borrower)
        internal
        view
        returns (uint256, uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 pendingReward = _getPendingReward(_asset, _borrower);
        uint256 pendingKUSDDebtReward = _getPendingKUSDDebtReward(_asset, _borrower);

        uint256 currentAsset = s.Troves[_borrower][_asset].coll + pendingReward;
        uint256 currentKUSDDebt = s.Troves[_borrower][_asset].debt + pendingKUSDDebtReward;

        return (currentAsset, currentKUSDDebt);
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function _getPendingReward(address _asset, address _borrower) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 snapshotAsset = s.rewardSnapshots[_borrower][_asset].asset;
        uint256 rewardPerUnitStaked = s.L_ASSETS[_asset] + snapshotAsset;
        if (rewardPerUnitStaked == 0 || !_isTroveActive(_asset, _borrower)) {
            return 0;
        }
        uint256 stake = s.Troves[_borrower][_asset].stake;
        uint256 pendingAssetReward = (stake * rewardPerUnitStaked) / KumoMath.DECIMAL_PRECISION;
        return pendingAssetReward;
    }

    function _isTroveActive(address _asset, address _borrower) internal view returns (bool) {
        return _getTroveStatus(_asset, _borrower) == uint256(Status.active);
    }

    function _getTroveStatus(address _asset, address _borrower) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return uint256(s.Troves[_borrower][_asset].status);
    }

    // Get the borrower's pending accumulated KUSD reward, earned by their stake
    function _getPendingKUSDDebtReward(address _asset, address _borrower)
        internal
        view
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 snapshotKUSDDebt = s.rewardSnapshots[_borrower][_asset].KUSDDebt;
        uint256 rewardPerUnitStaked = s.L_KUSDDebts[_asset] - snapshotKUSDDebt;

        if (rewardPerUnitStaked == 0 || !_isTroveActive(_asset, _borrower)) {
            return 0;
        }

        uint256 stake = s.Troves[_borrower][_asset].stake;

        uint256 pendingKUSDDebtReward = (stake * rewardPerUnitStaked) / KumoMath.DECIMAL_PRECISION;

        return pendingKUSDDebtReward;
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(
        address _asset,
        uint256 _KUSD,
        uint256 _amount
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.defaultPool.decreaseKUSDDebt(_asset, _KUSD);
        s.activePool.increaseKUSDDebt(_asset, _KUSD);
        s.defaultPool.sendAssetToActivePool(_asset, _amount);
    }

    function _calcDecayedBaseRate(address _asset) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 minutesPassed = _minutesPassedSinceLastFeeOp(_asset);
        uint256 decayFactor = KumoMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return (s.baseRate[_asset] * decayFactor) / KumoMath.DECIMAL_PRECISION;
    }

    function _minutesPassedSinceLastFeeOp(address _asset) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return (block.timestamp - s.lastFeeOperationTime[_asset]) / SECONDS_IN_ONE_MINUTE;
    }

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime(address _asset) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 timePassed = block.timestamp - s.lastFeeOperationTime[_asset];

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            s.lastFeeOperationTime[_asset] = block.timestamp;
            emit LastFeeOpTimeUpdated(_asset, block.timestamp);
        }
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _asset, address _borrower) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 stake = s.Troves[_borrower][_asset].stake;
        s.totalStakes[_asset] = s.totalStakes[_asset] - stake;
        s.Troves[_borrower][_asset].stake = 0;
    }

    function _closeTrove(
        address _asset,
        address _borrower,
        Status closedStatus
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

        uint256 TroveOwnersArrayLength = s.TroveOwners[_asset].length;
        _requireMoreThanOneTroveInSystem(_asset, TroveOwnersArrayLength);

        s.Troves[_borrower][_asset].status = closedStatus;
        s.Troves[_borrower][_asset].coll = 0;
        s.Troves[_borrower][_asset].debt = 0;

        s.rewardSnapshots[_borrower][_asset].asset = 0;
        s.rewardSnapshots[_borrower][_asset].KUSDDebt = 0;

        _removeTroveOwner(_asset, _borrower, TroveOwnersArrayLength);
        s.sortedTroves.remove(_asset, _borrower);
    }

    function _requireMoreThanOneTroveInSystem(address _asset, uint256 TroveOwnersArrayLength)
        internal
        view
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(
            TroveOwnersArrayLength > 1 && s.sortedTroves.getSize(_asset) > 1,
            "TroveManager: Only one trove in the system"
        );
    }

    /*
     * Remove a Trove owner from the s.TroveOwners array, not preserving array order. Removing owner 'B' does the following:
     * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
     */
    function _removeTroveOwner(
        address _asset,
        address _borrower,
        uint256 TroveOwnersArrayLength
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        Status troveStatus = s.Troves[_borrower][_asset].status;
        // It’s set in caller function `_closeTrove`
        assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

        uint128 index = s.Troves[_borrower][_asset].arrayIndex;
        uint256 length = TroveOwnersArrayLength;
        uint256 idxLast = length - 1;

        assert(index <= idxLast);

        address addressToMove = s.TroveOwners[_asset][idxLast];

        s.TroveOwners[_asset][index] = addressToMove;
        s.Troves[addressToMove][_asset].arrayIndex = index;
        emit TroveIndexUpdated(_asset, addressToMove, index);

        s.TroveOwners[_asset].pop();
    }

    function _updateTroveRewardSnapshots(address _asset, address _borrower) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.rewardSnapshots[_borrower][_asset].asset = s.L_ASSETS[_asset];
        s.rewardSnapshots[_borrower][_asset].KUSDDebt = s.L_KUSDDebts[_asset];
        emit TroveSnapshotsUpdated(_asset, s.L_ASSETS[_asset], s.L_KUSDDebts[_asset]);
    }

    function _calcRedemptionFee(uint256 _redemptionRate, uint256 _assetDraw)
        internal
        pure
        returns (uint256)
    {
        uint256 redemptionFee = (_redemptionRate * _assetDraw) / KumoMath.DECIMAL_PRECISION;
        require(
            redemptionFee < _assetDraw,
            "TroveManager: Fee would eat up all returned collateral"
        );
        return redemptionFee;
    }

     function _calcRedemptionRate(address _asset, uint256 _baseRate) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return
            KumoMath._min(
                s.kumoParams.REDEMPTION_FEE_FLOOR(_asset) + _baseRate,
                KumoMath.DECIMAL_PRECISION
            );
    }

    function _getRedemptionRate(address _asset) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return _calcRedemptionRate(_asset, s.baseRate[_asset]);
    }

    function _getRedemptionFee(address _asset, uint256 _assetDraw) internal view returns (uint256) {
        return _calcRedemptionFee(_getRedemptionRate(_asset), _assetDraw);
    }
}
