// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Dependencies/KumoSafeMath128.sol";

/* Tester contract for math functions in KumoSafeMath128.sol library. */

contract KumoSafeMath128Tester {
    using KumoSafeMath128 for uint128;

    function add(uint128 a, uint128 b) external pure returns (uint128) {
        return a.add(b);
    }

    function sub(uint128 a, uint128 b) external pure returns (uint128) {
        return a.sub(b);
    }
}
