// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    using SafeMathUpgradeable for uint256;
    
    function unprotectedIncreaseKUSDDebt(uint _amount) external {
        KUSDDebt  = KUSDDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }
}
