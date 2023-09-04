// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    using SafeMath for uint256;
    
    function unprotectedIncreaseKUSDDebt(address _asset, uint256 _amount) external {
        KUSDDebts[_asset]  = KUSDDebts[_asset].add(_amount);
    }

    function unprotectedPayable(address _asset, uint256 amount) external payable {
        amount = _asset == address(0) ? msg.value : amount;
		assetsBalance[_asset] = assetsBalance[_asset].add(msg.value);
    }
}
