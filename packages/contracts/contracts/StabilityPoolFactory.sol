// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./Dependencies/Ownable.sol";
import "./Interfaces/IStabilityPool.sol";

contract StabilityPoolFactory is Ownable {
    mapping(address => address) stabilityPools;
    mapping(address => bool) registeredStabiliyPools;

    function createNewStabilityPool(address _asset, address _stabilityPoolAddress)
        external
        onlyOwner
    {
        stabilityPools[_asset] = _stabilityPoolAddress;
        registeredStabiliyPools[_stabilityPoolAddress] = true;
    }

    function removeStabilityPool(address _asset) external onlyOwner {
        registeredStabiliyPools[stabilityPools[_asset]] = false;
        delete stabilityPools[_asset];
    }

    function getStabilityPoolByAsset(address _asset) public view returns (IStabilityPool) {
        return IStabilityPool(stabilityPools[_asset]);
    }

    function isRegisteredStabilityPool(address _stabilityPoolAddress) external view returns (bool) {
        return registeredStabiliyPools[_stabilityPoolAddress];
    }
}
