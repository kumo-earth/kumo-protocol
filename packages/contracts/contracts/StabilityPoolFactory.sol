// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./Dependencies/Ownable.sol";
import "./Interfaces/IStabilityPool.sol";

contract StabilityPoolFactory is Ownable {
  mapping(address => address) stabilityPools;

  function createNewSP(address _asset, address _stabilityPoolAddress) external onlyOwner {
    stabilityPools[_asset] = _stabilityPoolAddress;
  }

  function removeSP(address _asset) external onlyOwner {
    delete stabilityPools[_asset];
  }

  function getStabilityPoolByAsset(address _asset) external view returns (IStabilityPool) {
    return IStabilityPool(stabilityPools[_asset]);
  }

  function isRegisteredSP(address _asset) external view returns (bool) {
    return stabilityPools[_asset] != address(0);
  }
}