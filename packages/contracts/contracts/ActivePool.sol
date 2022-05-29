// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Interfaces/IActivePool.sol";
// import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/*
 * The Active Pool holds the ETH collateral and KUSD debt (but not KUSD tokens) for all active troves.
 *
 * When a trove is liquidated, it's ETH and KUSD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */

contract ActivePool is
    Initializable,
    CheckContract,
    OwnableUpgradeable,
    IActivePool,
    UUPSUpgradeable
{
    using SafeMathUpgradeable for uint256;
    bool public isInitialized;

    string public constant NAME = "ActivePool";

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 internal ETH; // deposited ether tracker
    uint256 internal KUSDDebt;

    // --- Events ---

    // event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    // event TroveManagerAddressChanged(address _newTroveManagerAddress);
    // event ActivePoolKUSDDebtUpdated(uint _KUSDDebt);
    // event ActivePoolETHBalanceUpdated(uint _ETH);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    ) external initializer {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);
        require(!isInitialized, "Already initialized");

        isInitialized = true;

        __Ownable_init();
        __UUPSUpgradeable_init();

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        renounceOwnership();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Getters for public variables. Required by IPool interface ---

    /*
     * Returns the ETH state variable.
     *
     *Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
     */
    function getETH() external view override returns (uint256) {
        return ETH;
    }

    function getKUSDDebt() external view override returns (uint256) {
        return KUSDDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        ETH = ETH.sub(_amount);
        emit ActivePoolETHBalanceUpdated(ETH);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call{value: _amount}("");
        require(success, "ActivePool: sending ETH failed");
    }

    function increaseKUSDDebt(uint256 _amount) external override {
        _requireCallerIsBOorTroveM();
        KUSDDebt = KUSDDebt.add(_amount);
        emit ActivePoolKUSDDebtUpdated(KUSDDebt);
    }

    function decreaseKUSDDebt(uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        KUSDDebt = KUSDDebt.sub(_amount);
        emit ActivePoolKUSDDebtUpdated(KUSDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool"
        );
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
                msg.sender == troveManagerAddress ||
                msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager"
        );
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
        ETH = ETH.add(msg.value);
        emit ActivePoolETHBalanceUpdated(ETH);
    }
}
