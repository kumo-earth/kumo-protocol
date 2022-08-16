// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import './Interfaces/IActivePool.sol';
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/IStabilityPoolManager.sol";
import "./Interfaces/ICollStakingManager.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IDeposit.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./Dependencies/SafetyTransfer.sol";

/*
 * The Active Pool holds the ETH collateral and KUSD debt (but not KUSD tokens) for all active troves.
 *
 * When a trove is liquidated, it's ETH and KUSD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
 
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMath for uint256;

    string constant public NAME = "ActivePool";
    address constant ETH_REF_ADDRESS = address(0);

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    IDefaultPool public defaultPool;
    // uint256 internal KUSDDebt;
    ICollSurplusPool public collSurplusPool;
    IStabilityPoolManager public stabilityPoolManager;
    // --- Events ---

    mapping(address => uint256) internal assetsBalance;
	mapping(address => uint256) internal KUSDDebts;
	mapping(address => uint256) internal assetsStaked;


    address private stakingAdmin;
    ICollStakingManager public collStakingManager;
    modifier onlyStakingAdmin {
		require(msg.sender == stakingAdmin, "ActivePool: not a staking admin");
		_;
	}

    // event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    // event TroveManagerAddressChanged(address _newTroveManagerAddress);
    // event ActivePoolKUSDDebtUpdated(uint256 _KUSDDebt);
    // event IERC20ActivePoolAssetBalanceUpdated(uint256 _ETH);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolManagerAddress,
        address _defaultPoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolManagerAddress);
        checkContract(_defaultPoolAddress);

        // __Ownable_init();

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
        // stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolManagerAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        _renounceOwnership();
    }

    function setCollStakingManagerAddress(address _collStakingManagerAddress) external onlyStakingAdmin {
		checkContract(_collStakingManagerAddress);

		collStakingManager = ICollStakingManager(_collStakingManagerAddress);
	}

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the ETH state variable.
    *
    *Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
    */
    function getAssetBalance(address _asset) external view override returns (uint256) {
		return assetsBalance[_asset];
	}

	function getAssetStaked(address _asset) external view override returns (uint256) {
		return assetsStaked[_asset];
	}

	function getKUSDDebt(address _asset) external view override returns (uint256) {
		return KUSDDebts[_asset];
	}

    // function getETH() external view override returns (uint256) {
    //     return ETH;
    // }

    // --- Pool functionality ---
function sendAsset(address _asset, address _account, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        // ETH = ETH.sub(_amount);
        assetsBalance[_asset] -= _amount;
        emit ActivePoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
        emit AssetSent(_account, _asset, _amount);

        (bool success, ) = _account.call{ value: _amount }("");
        require(success, "ActivePool: sending ETH failed");
    }

	function isERC20DepositContract(address _account) private view returns (bool) {
		return (_account == address(defaultPool) ||
			_account == address(collSurplusPool) ||
			stabilityPoolManager.isStabilityPool(_account));
	}
    // function sendAsset(address _account, uint256 _amount) external override {
    //     _requireCallerIsBOorTroveMorSP();
    //     ETH = ETH.sub(_amount);
    //     emit ActivePoolAssetBalanceUpdated(ETH);
    //     emit AssetSent(_account, _amount);

    //     (bool success, ) = _account.call{ value: _amount }("");
    //     require(success, "ActivePool: sending ETH failed");
    // }

    function increaseKUSDDebt(address _asset, uint256 _amount) external override {
        _requireCallerIsBOorTroveM();
        KUSDDebts[_asset]  = KUSDDebts[_asset].add(_amount);
        emit ActivePoolKUSDDebtUpdated(_asset, KUSDDebts[_asset] );
    }

    function decreaseKUSDDebt(address _asset, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        KUSDDebts[_asset] = KUSDDebts[_asset].sub(_amount);
        emit ActivePoolKUSDDebtUpdated(_asset, KUSDDebts[_asset] );
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool");
    }

    modifier callerIsBorrowerOperationOrDefaultPool() {
		require(
			msg.sender == borrowerOperationsAddress || msg.sender == address(defaultPool),
			"ActivePool: Caller is neither BO nor Default Pool"
		);

		_;
	}

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager");
    }

	function receivedERC20(address _asset, uint256 _amount) external override
		callerIsBorrowerOperationOrDefaultPool
	{
		assetsBalance[_asset] += _amount;
		_stakeCollateral(_asset, _amount);
		emit ActivePoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
	}

    	function forceStake(address _asset) external onlyStakingAdmin {
		_stakeCollateral(_asset, IERC20(_asset).balanceOf(address(this)));
	}

	function forceUnstake(address _asset) external onlyStakingAdmin {
		_unstakeCollateral(_asset, assetsStaked[_asset]);
	}

	function _stakeCollateral(address _asset, uint256 _amount) internal {
		if (address(collStakingManager) != address(0) && collStakingManager.isSupportedAsset(_asset)) {
			
			if (IERC20Upgradeable(_asset).allowance(address(this), address(collStakingManager)) < _amount) {
				IERC20Upgradeable(_asset).safeApprove(address(collStakingManager), type(uint256).max);
			}

			try collStakingManager.stakeCollaterals(_asset, _amount) {
				assetsStaked[_asset] += _amount;
			} catch {}
		}
	}

	function _unstakeCollateral(address _asset, uint256 _amount) internal {
		if (address(collStakingManager) != address(0)) {
			assetsStaked[_asset] -= _amount;
			collStakingManager.unstakeCollaterals(_asset, _amount);
		}
	}

    // --- Fallback function ---

	receive() external payable callerIsBorrowerOperationOrDefaultPool {
		assetsBalance[ETH_REF_ADDRESS] = assetsBalance[ETH_REF_ADDRESS].add(msg.value);
		emit ActivePoolAssetBalanceUpdated(ETH_REF_ADDRESS, assetsBalance[ETH_REF_ADDRESS]);
	}
}
