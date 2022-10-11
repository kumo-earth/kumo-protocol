// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../StabilityPool.sol";

contract StabilityPoolV2 is StabilityPool {
  uint newVar;

  function initializeV2(uint _newVar) external reinitializer(2) {
    newVar = _newVar; 
  }

  function testFunction() external view returns(uint) {
    return newVar;
  }
}