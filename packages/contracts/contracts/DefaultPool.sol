// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import './Interfaces/IDefaultPool.sol';
// import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
// import "./Dependencies/console.sol";


import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/*
 * The Default Pool holds the ETH and KUSD debt (but not KUSD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending ETH and KUSD debt, its pending ETH and KUSD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Initializable, OwnableUpgradeable, CheckContract, UUPSUpgradeable, IDefaultPool {
    using SafeMathUpgradeable for uint256;
	bool public isInitialized;
    
    string constant public NAME = "DefaultPool";

    address public troveManagerAddress;
    address public activePoolAddress;
    uint256 internal ETH;  // deposited ETH tracker
    uint256 internal KUSDDebt;  // debt

    // event TroveManagerAddressChanged(address _newTroveManagerAddress);
    // event DefaultPoolKUSDDebtUpdated(uint _KUSDDebt);
    // event DefaultPoolETHBalanceUpdated(uint _ETH);

    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress
    )
        external
		initializer
	{
		require(!isInitialized, "Already initialized");
		checkContract(_troveManagerAddress);
		checkContract(_activePoolAddress);
		isInitialized = true;

		__Ownable_init();
        __UUPSUpgradeable_init();

        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        renounceOwnership();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}


    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the ETH state variable.
    *
    * Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
    */
    function getETH() external view override returns (uint) {
        return ETH;
    }

    function getKUSDDebt() external view override returns (uint) {
        return KUSDDebt;
    }

    // --- Pool functionality ---

    function sendETHToActivePool(uint _amount) external override {
        _requireCallerIsTroveManager();
        address activePool = activePoolAddress; // cache to save an SLOAD
        ETH = ETH.sub(_amount);
        emit DefaultPoolETHBalanceUpdated(ETH);
        emit EtherSent(activePool, _amount);

        (bool success, ) = activePool.call{ value: _amount }("");
        require(success, "DefaultPool: sending ETH failed");
    }

    function increaseKUSDDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        KUSDDebt = KUSDDebt.add(_amount);
        emit DefaultPoolKUSDDebtUpdated(KUSDDebt);
    }

    function decreaseKUSDDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        KUSDDebt = KUSDDebt.sub(_amount);
        emit DefaultPoolKUSDDebtUpdated(KUSDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
        emit DefaultPoolETHBalanceUpdated(ETH);
    }
}
