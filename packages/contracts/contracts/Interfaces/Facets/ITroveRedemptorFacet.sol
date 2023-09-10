// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

// Common interface for the Trove Redemptor.
interface ITroveRedemptorFacet {
    function liquidate(address _asset, address _borrower) external;

    function liquidateTroves(address _asset, uint256 _n) external;

    function batchLiquidateTroves(address _asset, address[] memory _troveArray) external;

    function redeemCollateral(
        address _asset,
        uint256 _KUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external;

    function updateStakeAndTotalStakes(address _asset, address _borrower) external returns (uint256);

    function updateTroveRewardSnapshots(address _asset, address _borrower) external;

    function applyPendingRewards(address _asset, address _borrower) external;

    function hasPendingRewards(address _asset, address _borrower) external view returns (bool);
}
