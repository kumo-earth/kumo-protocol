// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./IStabilityPool.sol";

interface IStabilityPoolFactory {
  function createNewSP(address _asset, address _stabilityPoolAddress) external;

  function removeSP(address _asset) external;

  function getStabilityPoolByAsset(address _asset) external view returns (IStabilityPool);

  function isRegisteredSP(address _asset) external view returns (bool);
}