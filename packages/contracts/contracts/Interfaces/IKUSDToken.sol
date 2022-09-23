// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Dependencies/IERC20.sol";
// import "../Dependencies/ERC20Permit.sol";
import "../Dependencies/IERC2612.sol";

interface IKUSDToken is IERC20, IERC2612{ 
    
    // --- Events ---

    event TroveManagerAddressChanged(address _troveManagerAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    event KUSDTokenBalanceUpdated(address _user, uint256 _amount);
    
    function emergencyStopMinting(address _asset, bool status) external virtual;

    // --- Functions ---

    function mint(address asset, address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external;
}