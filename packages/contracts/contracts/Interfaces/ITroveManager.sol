// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./IKumoBase.sol";
import "./IStabilityPool.sol";
import "./IKUSDToken.sol";
import "./IKUMOToken.sol";
import "./IKUMOStaking.sol";
import "./IStabilityPoolManager.sol";



// Common interface for the Trove Manager.
interface ITroveManager is IKumoBase {

    enum Status {
		nonExistent,
		active,
		closedByOwner,
		closedByLiquidation,
		closedByRedemption
	}

    // Store the necessary data for a trove
	struct Trove {
		address asset;
		uint256 debt;
		uint256 coll;
		uint256 stake;
		Status status;
		uint128 arrayIndex;
	}

	//  * --- Variable container structs for liquidations ---
	//  *
	//  * These structs are used to hold, return and assign variables inside the liquidation functions,
	//  * in order to avoid the error: "CompilerError: Stack too deep".
	//  **/


	struct LocalVariables_AssetBorrowerPrice {
		address _asset;
		address _borrower;
		uint256 _price;
	}
    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event KUSDTokenAddressChanged(address _newKUSDTokenAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event KUMOTokenAddressChanged(address _kumoTokenAddress);
    event KUMOStakingAddressChanged(address _kumoStakingAddress);

    event Liquidation( address indexed _asset, uint256 _liquidatedDebt, uint256 _liquidatedColl, uint256 _collGasCompensation, uint256 _kusdGasCompensation);
    event Redemption( address indexed _asset, uint256 _attemptedKUSDAmount, uint256 _actualKUSDAmount, uint256 _AssetSent, uint256 _AssetFee);
    // event TroveUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint256 stake, uint8 operation);
    // event TroveLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation);
    event BaseRateUpdated(uint256 _baseRate);
    event LastFeeOpTimeUpdated(uint256 _lastFeeOpTime);
    event TotalStakesUpdated(uint256 _newTotalStakes);
    event SystemSnapshotsUpdated(uint256 _totalStakesSnapshot, uint256 _totalCollateralSnapshot);
    event LTermsUpdated(uint256 _L_ETH, uint256 _L_KUSDDebt);
    event TroveSnapshotsUpdated(address indexed _asset, uint256 _L_ETH, uint256 _L_KUSDDebt);
    event TroveIndexUpdated(address _borrower, uint256 _newIndex);
    event TotalStakesUpdated(address indexed _asset, uint256 _newTotalStakes);
    event SystemSnapshotsUpdated(address indexed _asset,uint256 _totalStakesSnapshot,uint256 _totalCollateralSnapshot);
    event BaseRateUpdated(address indexed _asset, uint256 _baseRate);
    event LastFeeOpTimeUpdated(address indexed _asset, uint256 _lastFeeOpTime);
    event TroveIndexUpdated(address indexed _asset, address _borrower, uint256 _newIndex);


    // --- Functions ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _kusdTokenAddress,
        address _sortedTrovesAddress,
        address _kumoTokenAddress,
        address _kumoStakingAddress,
        address _kumoParamsAddress

    ) external;

    function stabilityPoolManager() external view returns (IStabilityPoolManager);
    function stabilityPool() external view returns (IStabilityPool);
    function kusdToken() external view returns (IKUSDToken);
    function kumoToken() external view returns (IKUMOToken);
    function kumoStaking() external view returns (IKUMOStaking);

    function getTroveOwnersCount(address _asset) external view returns (uint256);

    function getTroveFromTroveOwnersArray(address _asset, uint256 _index) external view returns (address);

    function getNominalICR(address _asset, address _borrower) external view returns (uint256);
    function getCurrentICR(address _asset, address _borrower, uint256 _price) external view returns (uint256);

    function liquidate(address _asset, address _borrower) external;

    function liquidateTroves(address _asset, uint256 _n) external;

    function batchLiquidateTroves(address _asset, address[] calldata _troveArray) external;

    function redeemCollateral(
        address _asset,
        uint256 _KUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external; 

    function updateStakeAndTotalStakes(address _asset, address _borrower) external returns (uint256);

    function updateTroveRewardSnapshots(address _asset, address _borrower) external;

    function addTroveOwnerToArray(address _asset, address _borrower) external returns (uint256 index);

    function applyPendingRewards(address _asset, address _borrower) external;

    function getPendingReward(address _asset, address _borrower) external view returns (uint256);

    function getPendingKUSDDebtReward(address _asset, address _borrower) external view returns (uint256);

    function hasPendingRewards(address _asset, address _borrower) external view returns (bool);

    function getEntireDebtAndColl(address _asset, address _borrower) external view returns (
        uint256 debt, 
        uint256 coll, 
        uint256 pendingKUSDDebtReward, 
        uint256 pendingETHReward
    );

    function closeTrove(address _asset, address _borrower) external;

    function removeStake(address _asset, address _borrower) external;

    function getRedemptionRate(address _asset) external view returns (uint256);
    function getRedemptionRateWithDecay(address _asset) external view returns (uint256);

    function getRedemptionFeeWithDecay(address _asset, uint256 _assetDraw) external view returns (uint256);

    function getBorrowingRate(address _asset) external view returns (uint256);
    function getBorrowingRateWithDecay(address _asset) external view returns (uint256);

    function getBorrowingFee(address _asset, uint256 KUSDDebt) external view returns (uint256);
    function getBorrowingFeeWithDecay(address _asset, uint256 _KUSDDebt) external view returns (uint256);

    function decayBaseRateFromBorrowing(address _asset) external;

    function getTroveStatus(address _asset, address _borrower) external view returns (uint256);
    
    function getTroveStake(address _asset, address _borrower) external view returns (uint256);

    function getTroveDebt(address _asset, address _borrower) external view returns (uint256);

    function getTroveColl(address _asset, address _borrower) external view returns (uint256);

    function setTroveStatus(address _asset, address _borrower, uint256 num) external;

    function increaseTroveColl(address _asset, address _borrower, uint256 _collIncrease) external returns (uint256);

    function decreaseTroveColl(address _asset, address _borrower, uint256 _collDecrease) external returns (uint256); 

    function increaseTroveDebt(address _asset, address _borrower, uint256 _debtIncrease) external returns (uint256); 

    function decreaseTroveDebt(address _asset, address _borrower, uint256 _collDecrease) external returns (uint256); 

    function getTCR(address _asset, uint256 _price) external view returns (uint256);

    function checkRecoveryMode(address _asset, uint256 _price) external view returns (bool);
}
