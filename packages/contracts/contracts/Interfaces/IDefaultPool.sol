// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "./IPool.sol";


interface IDefaultPool is IPool {
    // --- Events ---
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolKUSDDebtUpdated(address _asset, uint256 _KUSDDebt);
    event DefaultPoolAssetBalanceUpdated(address _asset, uint256 _balance);

    // --- Functions ---
    function sendAssetToActivePool(address _asset, uint256 _amount) external;
}
