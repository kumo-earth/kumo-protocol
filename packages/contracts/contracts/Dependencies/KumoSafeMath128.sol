// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

// uint128 addition and subtraction, with overflow protection.

library KumoSafeMath128 {
    function add(uint128 a, uint128 b) internal pure returns (uint128) {
        uint128 c = a + b;
        require(c >= a, "KumoSafeMath128: addition overflow");

        return c;
    }
   
    function sub(uint128 a, uint128 b) internal pure returns (uint128) {
        require(b <= a, "KumoSafeMath128: subtraction overflow");
        uint128 c = a - b;

        return c;
    }
}