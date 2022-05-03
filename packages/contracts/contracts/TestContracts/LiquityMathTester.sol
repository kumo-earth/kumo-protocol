// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Dependencies/KumoMath.sol";

/* Tester contract for math functions in Math.sol library. */

contract KumoMathTester {

    function callMax(uint _a, uint _b) external pure returns (uint) {
        return KumoMath._max(_a, _b);
    }

    // Non-view wrapper for gas test
    function callDecPowTx(uint _base, uint _n) external pure returns (uint) {
        return KumoMath._decPow(_base, _n);
    }

    // External wrapper
    function callDecPow(uint _base, uint _n) external pure returns (uint) {
        return KumoMath._decPow(_base, _n);
    }
}
