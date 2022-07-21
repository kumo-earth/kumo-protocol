// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./IDeposit.sol";

// Common interface for the Pools.
interface IPool is IDeposit{
    
    // --- Events ---
    
    event ETHBalanceUpdated(uint256 _newBalance);
    event KUSDBalanceUpdated(uint256 _newBalance);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    // event sendAsset(address _to, uint256 _amount);
    event AssetSent(address _to, address indexed _asset, uint256 _amount);

    // --- Functions ---
    function getAssetBalance(address _asset) external view returns (uint256);

    // function getETH() external view returns (uint256);

    function getKUSDDebt(address _asset) external view returns (uint256);

    function increaseKUSDDebt(address _asset, uint256 _amount) external;

    function decreaseKUSDDebt(address _asset, uint256 _amount) external;
}
