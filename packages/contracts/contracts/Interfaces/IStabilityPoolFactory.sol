// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "./IStabilityPool.sol";

interface IStabilityPoolFactory {
    function createNewStabilityPool(address _asset, address _stabilityPoolAddress) external;

    function removeStabilityPool(address _asset) external;

    function getStabilityPoolByAsset(address _asset) external view returns (IStabilityPool);

    function isRegisteredStabilityPool(address _stabilityPoolAddress) external view returns (bool);
}
