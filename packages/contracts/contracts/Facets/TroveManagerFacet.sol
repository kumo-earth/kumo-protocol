// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Interfaces/Facets/ITroveManagerFacet.sol";
import "../Interfaces/IKumoParameters.sol";
import "../Dependencies/KumoMath.sol";
import "hardhat/console.sol";

import {LibAppStorage, Status, TroveManagerOperation, Modifiers} from "../Libraries/LibAppStorage.sol";
import {LibKumoBase} from "../Libraries/LibKumoBase.sol";
import {LibTroveManager} from "../Libraries/LibTroveManager.sol";

contract TroveManagerFacet is ITroveManagerFacet, Modifiers {
    string public constant NAME = "TroveManager";

    // --- getters from public variables

    function borrowerOperationsAddress() external view returns (address) {
        return s.borrowerOperationsAddress;
    }

    function stabilityPoolFactory() external view returns (IStabilityPoolFactory) {
        return s.stabilityPoolFactory;
    }

    function kusdToken() external view returns (IKUSDToken) {
        return s.kusdToken;
    }

    function kumoToken() external view returns (IKUMOToken) {
        return s.kumoToken;
    }

    function kumoStaking() external view returns (IKUMOStaking) {
        return s.kumoStaking;
    }

    function sortedTroves() external view returns (ISortedTroves) {
        return s.sortedTroves;
    }

    function SECONDS_IN_ONE_MINUTE() external pure returns (uint256) {
        return LibTroveManager.SECONDS_IN_ONE_MINUTE;
    }

    function MINUTE_DECAY_FACTOR() external pure returns (uint256) {
        return LibTroveManager.MINUTE_DECAY_FACTOR;
    }

    function BETA() external pure returns (uint256) {
        return LibTroveManager.BETA;
    }

    function baseRate() external view returns (uint256) {
        return s.baseRate;
    }

    function lastFeeOperationTime() external view returns (uint256) {
        return s.lastFeeOperationTime;
    }

    function Troves(address _asset, address _borrower) external view returns (Trove memory) {
        return s.Troves[_asset][_borrower];
    }

    function totalStakes(address _asset) external view returns (uint256) {
        return s.totalStakes[_asset];
    }

    function totalStakesSnapshot(address _asset) external view returns (uint256) {
        return s.totalStakesSnapshot[_asset];
    }

    function totalCollateralSnapshot(address _asset) external view returns (uint256) {
        return s.totalCollateralSnapshot[_asset];
    }

    function L_ASSETS(address _asset) external view returns (uint256) {
        return s.L_ASSETS[_asset];
    }

    function L_KUSDDebts(address _asset) external view returns (uint256) {
        return s.L_KUSDDebts[_asset];
    }

    function rewardSnapshots(
        address _asset,
        address _borrower
    ) external view returns (RewardSnapshot memory) {
        return s.rewardSnapshots[_asset][_borrower];
    }

    function TroveOwners(address _asset, uint256 _index) external view returns (address) {
        return s.TroveOwners[_asset][_index];
    }

    function lastAssetError_Redistribution(address _asset) external view returns (uint256) {
        return s.lastAssetError_Redistribution[_asset];
    }

    function lastKUSDDebtError_Redistribution(address _asset) external view returns (uint256) {
        return s.lastKUSDDebtError_Redistribution[_asset];
    }

    function isInitialized() external view returns (bool) {
        return s.isInitialized;
    }

    function redemptionWhitelist(address _asset) external view returns (bool) {
        return s.redemptionWhitelist[_asset];
    }

    function isRedemptionWhitelisted() external view returns (bool) {
        return s.isRedemptionWhitelisted;
    }

    // --- Dependency setter ---

    function setAddresses(address _kumoParamsAddress) external override onlyOwner {
        s.kumoParams = IKumoParameters(_kumoParamsAddress);

        s.borrowerOperationsAddress = address(s.kumoParams.borrowerOperations());
        s.gasPoolAddress = s.kumoParams.gasPoolAddress();
        s.collSurplusPool = s.kumoParams.collSurplusPool();
        s.kusdToken = s.kumoParams.kusdToken();
        s.sortedTroves = s.kumoParams.sortedTroves();
        s.kumoToken = s.kumoParams.kumoToken();
        s.kumoStaking = s.kumoParams.kumoStaking();
        s.stabilityPoolFactory = s.kumoParams.stabilityPoolFactory();
        s.defaultPool = s.kumoParams.defaultPool();
        s.activePool = s.kumoParams.activePool();
    }

    function addNewAsset(address _asset) external onlyOwner {
        s.L_ASSETS[_asset] = 0;
        s.L_KUSDDebts[_asset] = 0;
    }

    // --- Helper functions ---

    // Return the nominal collateral ratio (ICR) of a given Trove, without the price. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getNominalICR(
        address _asset,
        address _borrower
    ) public view override returns (uint256) {
        (uint256 currentAsset, uint256 currentKUSDDebt) = _getCurrentTroveAmounts(_asset, _borrower);

        uint256 NICR = KumoMath._computeNominalCR(currentAsset, currentKUSDDebt);
        return NICR;
    }

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(
        address _asset,
        address _borrower,
        uint256 _price
    ) public view override returns (uint256) {
        return LibTroveManager._getCurrentICR(_asset, _borrower, _price);
    }

    function _getCurrentTroveAmounts(
        address _asset,
        address _borrower
    ) internal view returns (uint256, uint256) {
        uint256 pendingReward = LibTroveManager._getPendingReward(_asset, _borrower);
        uint256 pendingKUSDDebtReward = LibTroveManager._getPendingKUSDDebtReward(_asset, _borrower);

        uint256 currentAsset = s.Troves[_asset][_borrower].coll + pendingReward;
        uint256 currentKUSDDebt = s.Troves[_asset][_borrower].debt + pendingKUSDDebtReward;

        return (currentAsset, currentKUSDDebt);
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingReward(
        address _asset,
        address _borrower
    ) public view override returns (uint256) {
        uint256 snapshotAsset = s.rewardSnapshots[_asset][_borrower].asset;
        uint256 rewardPerUnitStaked = s.L_ASSETS[_asset] - (snapshotAsset);
        if (rewardPerUnitStaked == 0 || !_isTroveActive(_asset, _borrower)) {
            return 0;
        }
        uint256 stake = s.Troves[_asset][_borrower].stake;
        uint256 pendingAssetReward = (stake * (rewardPerUnitStaked)) / (KumoMath.DECIMAL_PRECISION);
        return pendingAssetReward;
    }

    // Get the borrower's pending accumulated KUSD reward, earned by their stake
    function getPendingKUSDDebtReward(
        address _asset,
        address _borrower
    ) external view override returns (uint256) {
        return LibTroveManager._getPendingKUSDDebtReward(_asset, _borrower);
    }

    // Return the Troves entire debt and coll, including pending rewards from redistributions.
    function getEntireDebtAndColl(
        address _asset,
        address _borrower
    )
        external
        view
        returns (uint256 debt, uint256 coll, uint256 pendingKUSDDebtReward, uint256 pendingReward)
    {
        return LibTroveManager._getEntireDebtAndColl(_asset, _borrower);
    }

    function removeStake(address _asset, address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return LibTroveManager._removeStake(_asset, _borrower);
    }

    function closeTrove(address _asset, address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return LibTroveManager._closeTrove(_asset, _borrower, Status.closedByOwner);
    }

    // Push the owner's address to the Trove owners list, and record the corresponding array index on the Trove struct
    function addTroveOwnerToArray(
        address _asset,
        address _borrower
    ) external override returns (uint256 index) {
        _requireCallerIsBorrowerOperations();
        return _addTroveOwnerToArray(_asset, _borrower);
    }

    function _addTroveOwnerToArray(
        address _asset,
        address _borrower
    ) internal returns (uint128 index) {
        /* Max array size is 2**128 - 1, i.e. ~3e30 troves. No risk of overflow, since troves have minimum KUSD
        debt of liquidation reserve plus MIN_NET_DEBT. 3e30 KUSD dwarfs the value of all wealth in the world ( which is < 1e15 USD). */

        // Push the Troveowner to the array
        s.TroveOwners[_asset].push(_borrower);

        // Record the index of the new Troveowner on their Trove struct
        index = uint128(s.TroveOwners[_asset].length - 1);
        s.Troves[_asset][_borrower].arrayIndex = index;

        return index;
    }

    // --- Recovery Mode and TCR functions ---

    function getTCR(address _asset, uint256 _price) external view override returns (uint256) {
        return LibKumoBase._getTCR(_asset, _price);
    }

    function checkRecoveryMode(
        address _asset,
        uint256 _price
    ) external view override returns (bool) {
        return LibKumoBase._checkRecoveryMode(_asset, _price);
    }

    // --- Redemption fee functions ---

    function getRedemptionRateWithDecay(address _asset) public view override returns (uint256) {
        return LibTroveManager._calcRedemptionRate(_asset, LibTroveManager._calcDecayedBaseRate());
    }

    function getRedemptionRate(address _asset) external view override returns (uint256) {
        return LibTroveManager._getRedemptionRate(_asset);
    }

    function getRedemptionFee(address _asset, uint256 _assetDraw) external view returns (uint256) {
        return LibTroveManager._getRedemptionFee(_asset, _assetDraw);
    }

    function getRedemptionFeeWithDecay(
        address _asset,
        uint256 _assetDraw
    ) external view returns (uint256) {
        return LibTroveManager._calcRedemptionFee(getRedemptionRateWithDecay(_asset), _assetDraw);
    }

    // --- Borrowing fee functions ---

    function getBorrowingRate(address _asset) public view override returns (uint256) {
        return _calcBorrowingRate(_asset, s.baseRate);
    }

    function getBorrowingRateWithDecay(address _asset) public view returns (uint256) {
        return _calcBorrowingRate(_asset, LibTroveManager._calcDecayedBaseRate());
    }

    function _calcBorrowingRate(address _asset, uint256 _baseRate) internal view returns (uint256) {
        return
            KumoMath._min(
                s.kumoParams.BORROWING_FEE_FLOOR(_asset) + _baseRate,
                s.kumoParams.MAX_BORROWING_FEE(_asset)
            );
    }

    function getBorrowingFee(
        address _asset,
        uint256 _KUSDDebt
    ) external view override returns (uint256) {
        return _calcBorrowingFee(getBorrowingRate(_asset), _KUSDDebt);
    }

    function getBorrowingFeeWithDecay(
        address _asset,
        uint256 _KUSDDebt
    ) external view override returns (uint256) {
        return _calcBorrowingFee(getBorrowingRateWithDecay(_asset), _KUSDDebt);
    }

    function _calcBorrowingFee(
        uint256 _borrowingRate,
        uint256 _KUSDDebt
    ) internal pure returns (uint256) {
        return (_borrowingRate * _KUSDDebt) / KumoMath.DECIMAL_PRECISION;
    }

    // Updates the baseRate state variable based on time elapsed since the last redemption or KUSD borrowing operation.
    function decayBaseRateFromBorrowing() external override {
        _requireCallerIsBorrowerOperations();

        uint256 decayedBaseRate = LibTroveManager._calcDecayedBaseRate();
        assert(decayedBaseRate <= KumoMath.DECIMAL_PRECISION); // The baseRate can decay to 0

        s.baseRate = decayedBaseRate;
        emit LibTroveManager.BaseRateUpdated(decayedBaseRate);

        LibTroveManager._updateLastFeeOpTime();
    }

    // --- Getters ---

    function getTroveOwnersCount(address _asset) external view override returns (uint256) {
        return s.TroveOwners[_asset].length;
    }

    function getTroveFromTroveOwnersArray(
        address _asset,
        uint256 _index
    ) external view override returns (address) {
        return s.TroveOwners[_asset][_index];
    }

    // --- Trove property getters ---
    function _isTroveActive(address _asset, address _borrower) internal view returns (bool) {
        return this.getTroveStatus(_asset, _borrower) == uint256(Status.active);
    }

    function getTroveStatus(
        address _asset,
        address _borrower
    ) external view override returns (uint256) {
        return uint256(s.Troves[_asset][_borrower].status);
    }

    function getTroveStake(
        address _asset,
        address _borrower
    ) external view override returns (uint256) {
        return s.Troves[_asset][_borrower].stake;
    }

    function getTroveDebt(
        address _asset,
        address _borrower
    ) external view override returns (uint256) {
        return s.Troves[_asset][_borrower].debt;
    }

    function getTroveColl(
        address _asset,
        address _borrower
    ) external view override returns (uint256) {
        return s.Troves[_asset][_borrower].coll;
    }

    function getEntireSystemColl(address _asset) external view returns (uint256 entireSystemColl) {
        return LibKumoBase._getEntireSystemColl(_asset);
    }

    function getEntireSystemDebt(address _asset) external view returns (uint256 entireSystemDebt) {
        return LibKumoBase._getEntireSystemDebt(_asset);
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function setTroveStatus(address _asset, address _borrower, uint256 _num) external override {
        _requireCallerIsBorrowerOperations();
        s.Troves[_asset][_borrower].asset = _asset;
        s.Troves[_asset][_borrower].status = Status(_num);
    }

    function increaseTroveColl(
        address _asset,
        address _borrower,
        uint256 _collIncrease
    ) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newColl = s.Troves[_asset][_borrower].coll + _collIncrease;
        s.Troves[_asset][_borrower].coll = newColl;
        return newColl;
    }

    function decreaseTroveColl(
        address _asset,
        address _borrower,
        uint256 _collDecrease
    ) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newColl = s.Troves[_asset][_borrower].coll - _collDecrease;
        s.Troves[_asset][_borrower].coll = newColl;
        return newColl;
    }

    function increaseTroveDebt(
        address _asset,
        address _borrower,
        uint256 _debtIncrease
    ) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newDebt = s.Troves[_asset][_borrower].debt + _debtIncrease;
        s.Troves[_asset][_borrower].debt = newDebt;
        return newDebt;
    }

    function decreaseTroveDebt(
        address _asset,
        address _borrower,
        uint256 _debtDecrease
    ) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newDebt = s.Troves[_asset][_borrower].debt - _debtDecrease;
        s.Troves[_asset][_borrower].debt = newDebt;
        return newDebt;
    }
}
