// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Interfaces/IActivePool.sol";
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IDeposit.sol";
import "./Interfaces/IKUMOStaking.sol";
import "./Interfaces//IStabilityPoolFactory.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafetyTransfer.sol";

/*
 * The Active Pool holds the collateral of all Assets and KUSD debt (but not KUSD tokens) for all active troves.
 *
 * When a trove is liquidated, it's asset and KUSD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */

contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMath for uint256;

    string public constant NAME = "ActivePool";

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public defaultPoolAddress;
    address public kumoStakingAddress;
    address public collSurplusPoolAddress;
    address public troveRedemptorAddress;

    IStabilityPoolFactory public stabilityPoolFactory;

    // --- Events ---

    mapping(address => uint256) internal assetsBalance;
    mapping(address => uint256) internal KUSDDebts;
    mapping(address => uint256) internal assetsStaked;

    address private stakingAdmin;
    modifier onlyStakingAdmin() {
        require(msg.sender == stakingAdmin, "ActivePool: not a staking admin");
        _;
    }

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolFactoryAddress,
        address _defaultPoolAddress,
        address _collSurplusPoolAddress,
        address _kumoStakingAddress
    ) external onlyOwner {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolFactoryAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_kumoStakingAddress);

        // __Ownable_init();

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolFactory = IStabilityPoolFactory(_stabilityPoolFactoryAddress);
        defaultPoolAddress = _defaultPoolAddress;
        collSurplusPoolAddress = _collSurplusPoolAddress;
        kumoStakingAddress = _kumoStakingAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolFactoryAddressChanged(_stabilityPoolFactoryAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit KumoStakingAddressChanged(_kumoStakingAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
     * Returns the Asset state variable.
     *
     *Not necessarily equal to the the contract's raw Asset balance - assets can be forcibly sent to contracts.
     */
    function getAssetBalance(address _asset) external view override returns (uint256) {
        return assetsBalance[_asset];
    }

    function getKUSDDebt(address _asset) external view override returns (uint256) {
        return KUSDDebts[_asset];
    }

    // --- Pool functionality ---
    function sendAsset(
        address _asset,
        address _account,
        uint256 _amount
    ) external override {
        _requireCallerIsBOorTroveMorSPorTroveR();

        uint256 safetyTransferAmount = SafetyTransfer.decimalsCorrection(_asset, _amount);
        if (safetyTransferAmount == 0) return;

        assetsBalance[_asset] -= _amount;

        IERC20Upgradeable(_asset).safeTransfer(_account, safetyTransferAmount);
        if (isERC20DepositContract(_account)) {
            IDeposit(_account).receivedERC20(_asset, _amount);
        }

        emit ActivePoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
        emit AssetSent(_account, _asset, safetyTransferAmount);
    }

    function isERC20DepositContract(address _account) private view returns (bool) {
        return (_account == defaultPoolAddress ||
            _account == collSurplusPoolAddress ||
            _account == kumoStakingAddress ||
            stabilityPoolFactory.isRegisteredStabilityPool(_account));
    }

    function increaseKUSDDebt(address _asset, uint256 _amount) external override {
        _requireCallerIsBOorTroveM();
        KUSDDebts[_asset] = KUSDDebts[_asset].add(_amount);
        emit ActivePoolKUSDDebtUpdated(_asset, KUSDDebts[_asset]);
    }

    function decreaseKUSDDebt(address _asset, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSPorTroveR();
        KUSDDebts[_asset] = KUSDDebts[_asset].sub(_amount);
        emit ActivePoolKUSDDebtUpdated(_asset, KUSDDebts[_asset]);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool"
        );
    }

    function _requireCallerIsBOorTroveMorSPorTroveR() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
                msg.sender == troveManagerAddress ||
                msg.sender == troveRedemptorAddress ||
                stabilityPoolFactory.isRegisteredStabilityPool(msg.sender),
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool nor TroveRedemptor"
        );
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager"
        );
    }

    function receivedERC20(address _asset, uint256 _amount) external override {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
        assetsBalance[_asset] += _amount;
        emit ActivePoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
    }
}
