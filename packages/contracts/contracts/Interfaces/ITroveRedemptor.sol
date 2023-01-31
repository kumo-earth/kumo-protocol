// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./ITroveEvents.sol";

interface ITroveRedemptor is ITroveEvents {
    function setAddresses(
        address _troveManagerAddress,
        address _sortedTrovesAddress,
        address _stabilityPoolFactoryAddress,
        address _kusdTokenAddress,
        address _collSurplusPoolAddress,
        address _kumoParamsAddress
    ) external;

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

    function batchLiquidateTroves(
        address _asset,
        address[] memory _troveArray,
        address _sender
    ) external;

    function liquidateTroves(
        address _asset,
        uint256 _n,
        address _caller
    ) external;
}
