// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../StabilityPool.sol";

contract StabilityPoolTester is StabilityPool {
    using SafeMath for uint256;
    
    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }

    function setCurrentScale(uint128 _currentScale) external {
        currentScale = _currentScale;
    }

    function setTotalDeposits(uint _totalKUSDDeposits) external {
        totalKUSDDeposits = _totalKUSDDeposits;
    }
}
