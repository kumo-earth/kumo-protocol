// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Interfaces/ICollSurplusPool.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "hardhat/console.sol";
import "./Dependencies/SafetyTransfer.sol";

contract CollSurplusPool is Ownable, CheckContract, ICollSurplusPool {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // bool public isInitialized;
    string public constant NAME = "CollSurplusPool";

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public activePoolAddress;

    // deposited asset tracker
    mapping(address => uint256) internal assetBalances;
    // Collateral surplus claimable by trove owners
    mapping(address => mapping(address => uint256)) internal userBalances;

    // --- Events ---

    // event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    // event TroveManagerAddressChanged(address _newTroveManagerAddress);
    // event ActivePoolAddressChanged(address _newActivePoolAddress);

    // event CollBalanceUpdated(address indexed _account, uint256 _newBalance);
    // event AssetSent(address _to, uint256 _amount);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _activePoolAddress
    ) external override onlyOwner {
        // require(!isInitialized, "Already initialized");
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        // isInitialized = true;

        // __Ownable_init();

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    /* Returns the Asset state variable at ActivePool address. */
    function getAssetBalance(address _asset) external view override returns (uint256) {
        return assetBalances[_asset];
    }

    function getCollateral(address _asset, address _account)
        external
        view
        override
        returns (uint256)
    {
        return userBalances[_account][_asset];
    }

    // --- Pool functionality ---

    function accountSurplus(
        address _asset,
        address _account,
        uint256 _amount
    ) external override {
        _requireCallerIsTroveManager();

        uint256 newAmount = userBalances[_account][_asset].add(_amount);
        userBalances[_account][_asset] = newAmount;

        emit CollBalanceUpdated(_account, _asset, newAmount);
    }

    function claimColl(address _asset, address _account) external override {
        _requireCallerIsBorrowerOperations();
        uint256 claimableCollEther = userBalances[_account][_asset];

        uint256 safetyTransferclaimableColl = SafetyTransfer.decimalsCorrection(
            _asset,
            userBalances[_account][_asset]
        );

        require(
            safetyTransferclaimableColl > 0,
            "CollSurplusPool: No collateral available to claim"
        );

        userBalances[_account][_asset] = 0;
        emit CollBalanceUpdated(_account, _asset, 0);

        assetBalances[_asset] = assetBalances[_asset].sub(claimableCollEther);
        emit AssetSent(_account, _asset, safetyTransferclaimableColl);

        IERC20Upgradeable(_asset).safeTransfer(_account, safetyTransferclaimableColl);
    }

    function receivedERC20(address _asset, uint256 _amount) external override {
        _requireCallerIsActivePool();
        assetBalances[_asset] = assetBalances[_asset].add(_amount);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(
            msg.sender == borrowerOperationsAddress,
            "CollSurplusPool: Caller is not Borrower Operations"
        );
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "CollSurplusPool: Caller is not TroveManager");
    }

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "CollSurplusPool: Caller is not Active Pool");
    }
}
