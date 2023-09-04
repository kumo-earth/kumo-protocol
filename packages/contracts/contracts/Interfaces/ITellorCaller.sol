// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

interface ITellorCaller {
    function getTellorCurrentValue(bytes32 _queryId) external view returns (bool, uint256, uint256);
}