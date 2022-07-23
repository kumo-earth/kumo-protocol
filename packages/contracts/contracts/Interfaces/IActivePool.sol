// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./IPool.sol";


interface IActivePool is IPool {
    // --- Events ---
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolKUSDDebtUpdated(address _asset, uint256 _KUSDDebt);
    event ActivePoolAssetBalanceUpdated(address _asset, uint256 _ETH);

    // --- Functions ---
    // function getAssetBalance(address _asset, address _account, uint256 _amount) external;

    function sendAsset(address _asset, address _account, uint256 _amount) external;

	function getAssetStaked(address _asset) external view returns (uint256);
}
