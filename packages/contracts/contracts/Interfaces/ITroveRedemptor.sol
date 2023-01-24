// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./ITroveEvents.sol";

interface ITroveRedemptor is ITroveEvents {
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
    ) external;

    function batchLiquidateTroves(address _asset, address[] memory _troveArray) external;
}
