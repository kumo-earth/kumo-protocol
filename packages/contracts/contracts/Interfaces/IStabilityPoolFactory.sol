// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IStabilityPoolFactory {
  function createNewSP(address _asset, address _stabilityPoolAddress) external;

  function removeSP(address _asset) external;

  function getAssetSP(address _asset) external view returns (address);

  function isRegisteredSP(address _asset) external view returns (bool);
}