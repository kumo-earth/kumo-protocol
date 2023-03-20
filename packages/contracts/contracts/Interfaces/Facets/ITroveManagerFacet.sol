// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import {Trove, RewardSnapshot} from "../../Libraries/LibAppStorage.sol";
import "../ICollSurplusPool.sol";
import "../IKUSDToken.sol";
import "../ISortedTroves.sol";
import "../IKUMOToken.sol";
import "../IKUMOStaking.sol";
import "../IKumoParameters.sol";
import "../IStabilityPoolFactory.sol";

// Common interface for the Trove Manager.
interface ITroveManagerFacet {
    // --- Functions ---

    function setAddresses(address _kumoParamsAddress) external;

    function getTroveFromTroveOwnersArray(address _asset, uint256 _index)
        external
        view
        returns (address);

    function getNominalICR(address _asset, address _borrower) external view returns (uint256);

    function getCurrentICR(
        address _asset,
        address _borrower,
        uint256 _price
    ) external view returns (uint256);

    function addTroveOwnerToArray(address _asset, address _borrower)
        external
        returns (uint256 index);

    function getPendingReward(address _asset, address _borrower) external view returns (uint256);

    function getPendingKUSDDebtReward(address _asset, address _borrower)
        external
        view
        returns (uint256);

    function closeTrove(address _asset, address _borrower) external;

    function removeStake(address _asset, address _borrower) external;

    function getRedemptionRate(address _asset) external view returns (uint256);

    function getRedemptionFee(address _asset, uint256 _assetDraw) external returns (uint256);

    function getRedemptionRateWithDecay(address _asset) external view returns (uint256);

    function getRedemptionFeeWithDecay(address _asset, uint256 _assetDraw)
        external
        view
        returns (uint256);

    function getBorrowingRate(address _asset) external view returns (uint256);

    function getBorrowingRateWithDecay(address _asset) external view returns (uint256);

    function getBorrowingFee(address _asset, uint256 KUSDDebt) external view returns (uint256);

    function getBorrowingFeeWithDecay(address _asset, uint256 _KUSDDebt)
        external
        view
        returns (uint256);

    function decayBaseRateFromBorrowing(address _asset) external;

    function getTroveStatus(address _asset, address _borrower) external view returns (uint256);

    function getTroveStake(address _asset, address _borrower) external view returns (uint256);

    function getTroveDebt(address _asset, address _borrower) external view returns (uint256);

    function getTroveColl(address _asset, address _borrower) external view returns (uint256);

    function getTroveOwnersCount(address _asset) external view returns (uint256);

    function setTroveStatus(
        address _asset,
        address _borrower,
        uint256 num
    ) external;

    function increaseTroveColl(
        address _asset,
        address _borrower,
        uint256 _collIncrease
    ) external returns (uint256);

    function decreaseTroveColl(
        address _asset,
        address _borrower,
        uint256 _collDecrease
    ) external returns (uint256);

    function increaseTroveDebt(
        address _asset,
        address _borrower,
        uint256 _debtIncrease
    ) external returns (uint256);

    function decreaseTroveDebt(
        address _asset,
        address _borrower,
        uint256 _collDecrease
    ) external returns (uint256);

    function getTCR(address _asset, uint256 _price) external view returns (uint256);

    function checkRecoveryMode(address _asset, uint256 _price) external view returns (bool);

    function addNewAsset(address _asset) external;

    // --- getters from public variables

    function borrowerOperationsAddress() external view returns (address);

    function stabilityPoolFactory() external view returns (IStabilityPoolFactory);

    function kusdToken() external view returns (IKUSDToken);

    function kumoToken() external view returns (IKUMOToken);

    function kumoStaking() external view returns (IKUMOStaking);

    function sortedTroves() external view returns (ISortedTroves);

    function SECONDS_IN_ONE_MINUTE() external view returns (uint256);

    function MINUTE_DECAY_FACTOR() external view returns (uint256);

    function BETA() external view returns (uint256);

    function baseRate(address _asset) external view returns (uint256);

    function lastFeeOperationTime(address _asset) external view returns (uint256);

    function Troves(address _borrower, address _asset) external view returns (Trove memory);

    function totalStakes(address _asset) external view returns (uint256);

    function totalStakesSnapshot(address _asset) external view returns (uint256);

    function totalCollateralSnapshot(address _asset) external view returns (uint256);

    function L_ASSETS(address _asset) external view returns (uint256);

    function L_KUSDDebts(address _asset) external view returns (uint256);

    function rewardSnapshots(address _borrower, address _asset)
        external
        view
        returns (RewardSnapshot memory);

    function TroveOwners(address _asset, uint256 _index) external view returns (address);

    function lastAssetError_Redistribution(address _asset) external view returns (uint256);

    function lastKUSDDebtError_Redistribution(address _asset) external view returns (uint256);

    function isInitialized() external view returns (bool);

    function redemptionWhitelist(address _asset) external view returns (bool);

    function isRedemptionWhitelisted() external view returns (bool);
}
