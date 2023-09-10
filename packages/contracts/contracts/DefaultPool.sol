// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Interfaces/IDefaultPool.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafetyTransfer.sol";

/*
 * The Default Pool holds the ETH and KUSD debt (but not KUSD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending ETH and KUSD debt, its pending ETH and KUSD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Ownable, CheckContract, IDefaultPool {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // bool public isInitialized;

    string public constant NAME = "DefaultPool";

    address public troveManagerAddress;
    address public activePoolAddress;

    // event TroveManagerAddressChanged(address _newTroveManagerAddress);
    // event DefaultPoolKUSDDebtsUpdated(uint256 _KUSDDebts);
    // event DefaultPoolETHBalanceUpdated(uint256 _ETH);

    mapping(address => uint256) internal assetsBalance;
    mapping(address => uint256) internal KUSDDebts; // debt

    // --- Dependency setters ---

    function setAddresses(address _troveManagerAddress, address _activePoolAddress)
        external
        onlyOwner
    {
        // require(!isInitialized, "Already initialized");
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        // isInitialized = true;

        // __Ownable_init();

        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
     * Returns the ETH state variable.
     *
     * Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
     */
    function getAssetBalance(address _asset) external view override returns (uint256) {
        return assetsBalance[_asset];
    }

    function getKUSDDebt(address _asset) external view override returns (uint256) {
        return KUSDDebts[_asset];
    }

    // --- Pool functionality ---

    function sendAssetToActivePool(address _asset, uint256 _amount) external override {
        _requireCallerIsTroveManager();
        address activePool = activePoolAddress; // cache to save an SLOAD

        uint256 safetyTransferAmount = SafetyTransfer.decimalsCorrection(_asset, _amount);
        if (safetyTransferAmount == 0) return;

        assetsBalance[_asset] = assetsBalance[_asset].sub(_amount);

        IERC20Upgradeable(_asset).safeTransfer(activePool, safetyTransferAmount);
        IDeposit(activePool).receivedERC20(_asset, _amount);

        emit DefaultPoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
        emit AssetSent(activePool, _asset, safetyTransferAmount);
    }

    function increaseKUSDDebt(address _asset, uint256 _amount) external override {
        _requireCallerIsTroveManager();
        KUSDDebts[_asset] = KUSDDebts[_asset].add(_amount);
        emit DefaultPoolKUSDDebtUpdated(_asset, KUSDDebts[_asset]);
    }

    function decreaseKUSDDebt(address _asset, uint256 _amount) external override {
        _requireCallerIsTroveManager();
        KUSDDebts[_asset] = KUSDDebts[_asset].sub(_amount);
        emit DefaultPoolKUSDDebtUpdated(_asset, KUSDDebts[_asset]);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }

    modifier callerIsActivePool() {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
        _;
    }

    modifier callerIsTroveManager() {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
        _;
    }

    function receivedERC20(address _asset, uint256 _amount) external override callerIsActivePool {
        assetsBalance[_asset] = assetsBalance[_asset].add(_amount);
        emit DefaultPoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
    }
}
