// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IKUSDToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IKUMOToken.sol";
import "./Interfaces/IKUMOStaking.sol";
import "./Dependencies/KumoBase.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./Dependencies/SafeMath.sol";

contract TroveManager is KumoBase, CheckContract, ITroveManager {
    using SafeMath for uint256;
    
	// bool public isInitialized;

    string constant public NAME = "TroveManager";

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IStabilityPool public override stabilityPool;
    IStabilityPoolManager public stabilityPoolManager;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IKUSDToken public override kusdToken;

    IKUMOToken public override kumoToken;

    IKUMOStaking public override kumoStaking;

    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    // --- Data structures ---

	uint256 public constant SECONDS_IN_ONE_MINUTE = 60;
	/*
	 * Half-life of 12h. 12h = 720 min
	 * (1/2) = d^720 => d = (1/2)^(1/720)
	 */
	uint256 public constant MINUTE_DECAY_FACTOR = 999037758833783000;

	/*
	 * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
	 * Corresponds to (1 / ALPHA) in the white paper.
	 */
	uint256 public constant BETA = 2;

	mapping(address => uint256) public baseRate;

	// The timestamp of the latest fee operation (redemption or new KUSD issuance)
	mapping(address => uint256) public lastFeeOperationTime;

	mapping(address => mapping(address => Trove)) public Troves;

	mapping(address => uint256) public totalStakes;

	// Snapshot of the value of totalStakes, taken immediately after the latest liquidation
	mapping(address => uint256) public totalStakesSnapshot;

	// Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
	mapping(address => uint256) public totalCollateralSnapshot;

	/*
	 * L_amount and L_KUSDDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
	 *
	 * An ETH gain of ( stake * [L_amount - L_amount(0)] )
	 * A KUSDDebt increase  of ( stake * [L_KUSDDebt - L_KUSDDebt(0)] )
	 *
	 * Where L_amount(0) and L_KUSDDebt(0) are snapshots of L_amount and L_KUSDDebt for the active Trove taken at the instant the stake was made
	 */
	mapping(address => uint256) public L_ASSETS;
	mapping(address => uint256) public L_KUSDDebts;

	// Map addresses with active troves to their RewardSnapshot
	mapping(address => mapping(address => RewardSnapshot)) public rewardSnapshots;

	// Object containing the ETH and KUSD snapshots for a given active trove
	struct RewardSnapshot {
		uint256 asset;
		uint256 KUSDDebt;
	}

	// Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
	mapping(address => address[]) public TroveOwners;

	// Error trackers for the trove redistribution calculation
	mapping(address => uint256) public lastETHError_Redistribution;
	mapping(address => uint256) public lastKUSDDebtError_Redistribution;

	bool public isInitialized;

	mapping(address => bool) public redemptionWhitelist;
	bool public isRedemptionWhitelisted;

    /*
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep".
    **/

    struct LocalVariables_OuterLiquidationFunction {
        uint256 price;
        uint256 KUSDInStabPool;
        bool recoveryModeAtStart;
        uint256 liquidatedDebt;
        uint256 liquidatedColl;
    }

    struct LocalVariables_InnerSingleLiquidateFunction {
        uint256 collToLiquidate;
        uint256 pendingDebtReward;
        uint256 pendingCollReward;
    }

    struct LocalVariables_LiquidationSequence {
        uint256 remainingKUSDInStabPool;
        uint256 i;
        uint256 ICR;
        address user;
        bool backToNormalMode;
        uint256 entireSystemDebt;
        uint256 entireSystemColl;
    }

    struct LiquidationValues {
        uint256 entireTroveDebt;
        uint256 entireTroveColl;
        uint256 collGasCompensation;
        uint256 kusdGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
    }

    struct LiquidationTotals {
        uint256 totalCollInSequence;
        uint256 totalDebtInSequence;
        uint256 totalCollGasCompensation;
        uint256 totalkusdGasCompensation;
        uint256 totalDebtToOffset;
        uint256 totalCollToSendToSP;
        uint256 totalDebtToRedistribute;
        uint256 totalCollToRedistribute;
        uint256 totalCollSurplus;
    }

    struct ContractsCache {
        IActivePool activePool;
        IDefaultPool defaultPool;
        IKUSDToken kusdToken;
        IKUMOStaking kumoStaking;
        ISortedTroves sortedTroves;
        ICollSurplusPool collSurplusPool;
        address gasPoolAddress;
    }
    // --- Variable container structs for redemptions ---

    struct RedemptionTotals {
        uint256 remainingKUSD;
        uint256 totalKUSDToRedeem;
        uint256 totalETHDrawn;
        uint256 ETHFee;
        uint256 ETHToSendToRedeemer;
        uint256 decayedBaseRate;
        uint256 price;
        uint256 totalKUSDSupplyAtStart;
    }

    struct SingleRedemptionValues {
        uint256 KUSDLot;
        uint256 ETHLot;
        bool cancelledPartial;
    }

    // --- Events ---

    // event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    // event PriceFeedAddressChanged(address _newPriceFeedAddress);
    // event KUSDTokenAddressChanged(address _newKUSDTokenAddress);
    // event ActivePoolAddressChanged(address _activePoolAddress);
    // event DefaultPoolAddressChanged(address _defaultPoolAddress);
    // event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    // event GasPoolAddressChanged(address _gasPoolAddress);
    // event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    // event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    // event KUMOTokenAddressChanged(address _kumoTokenAddress);
    // event KUMOStakingAddressChanged(address _kumoStakingAddress);

    // event Liquidation(uint256 _liquidatedDebt, uint256 _liquidatedColl, uint256 _collGasCompensation, uint256 _kusdGasCompensation);
    // event Redemption(uint256 _attemptedKUSDAmount, uint256 _actualKUSDAmount, uint256 _amountSent, uint256 _amountFee);
    event TroveUpdated(address indexed _asset, address indexed _borrower, uint256 _debt, uint256 _coll, uint256 _stake, TroveManagerOperation _operation);
    event TroveLiquidated(address indexed _asset, address indexed _borrower, uint256 _debt, uint256 _coll, TroveManagerOperation _operation);
    // event BaseRateUpdated(uint256 _baseRate);
    // event LastFeeOpTimeUpdated(uint256 _lastFeeOpTime);
    // event TotalStakesUpdated(uint256 _newTotalStakes);
    // event SystemSnapshotsUpdated(uint256 _totalStakesSnapshot, uint256 _totalCollateralSnapshot);
    // event LTermsUpdated(uint256 _L_ASSETS, uint256 _L_KUSDDebt);
    // event TroveSnapshotsUpdated(uint256 _L_ASSETS, uint256 _L_KUSDDebt);
    // event TroveIndexUpdated(address _borrower, uint256 _newIndex);

     enum TroveManagerOperation {
        applyPendingRewards,
        liquidateInNormalMode,
        liquidateInRecoveryMode,
        redeemCollateral
    }


    // --- Dependency setter ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _stabilityPoolManagerAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _kusdTokenAddress,
        address _sortedTrovesAddress,
        address _kumoTokenAddress,
        address _kumoStakingAddress,
        address _kumoParamsAddress
    )
        external
        override
        onlyOwner
    {
        // require(!isInitialized, "Already initialized");
        checkContract(_borrowerOperationsAddress);
        checkContract(_stabilityPoolManagerAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_kusdTokenAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_kumoTokenAddress);
        checkContract(_kumoStakingAddress);
        checkContract(_kumoParamsAddress);

        
        // isInitialized = true;
		// __Ownable_init();

        borrowerOperationsAddress = _borrowerOperationsAddress;
        //stabilityPool = IStabilityPool(_stabilityPoolAddress);
        stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        kusdToken = IKUSDToken(_kusdTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        kumoToken = IKUMOToken(_kumoTokenAddress);
        kumoStaking = IKUMOStaking(_kumoStakingAddress);

        setKumoParameters(_kumoParamsAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolManagerAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit KUSDTokenAddressChanged(_kusdTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit KUMOTokenAddressChanged(_kumoTokenAddress);
        emit KUMOStakingAddressChanged(_kumoStakingAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    function getTroveOwnersCount(address _asset) external view override returns (uint256) {
        return TroveOwners[_asset].length;
    }

    function getTroveFromTroveOwnersArray(address _asset, uint256 _index) external view override returns (address) {
        return TroveOwners[_asset][_index];
    }

    // --- Trove Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
    function liquidate(address _asset, address _borrower) external override {
        _requireTroveIsActive(_asset, _borrower);

        address[] memory borrowers = new address[](1);
        borrowers[0] = _borrower;
        batchLiquidateTroves(_asset, borrowers);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(
        address _asset,
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        address _borrower,
        uint256 _KUSDInStabPool
    )
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        LocalVariables_InnerSingleLiquidateFunction memory vars;

        (singleLiquidation.entireTroveDebt,
        singleLiquidation.entireTroveColl,
        vars.pendingDebtReward,
        vars.pendingCollReward) = getEntireDebtAndColl(_asset, _borrower);

        _movePendingTroveRewardsToActivePool(_asset, _activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
        _removeStake(_asset, _borrower);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(_asset, singleLiquidation.entireTroveColl);
        singleLiquidation.kusdGasCompensation = kumoParams.KUSD_GAS_COMPENSATION(_asset);
        uint256 collToLiquidate = singleLiquidation.entireTroveColl.sub(singleLiquidation.collGasCompensation);

        (singleLiquidation.debtToOffset,
        singleLiquidation.collToSendToSP,
        singleLiquidation.debtToRedistribute,
        singleLiquidation.collToRedistribute) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, collToLiquidate, _KUSDInStabPool);

        _closeTrove(_asset, _borrower, Status.closedByLiquidation);
        emit TroveLiquidated(_asset, _borrower, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInNormalMode);
        emit TroveUpdated(_asset, _borrower, 0, 0, 0, TroveManagerOperation.liquidateInNormalMode);
        return singleLiquidation;
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(
        address _asset,
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        address _borrower,
        uint256 _ICR,
        uint256 _KUSDInStabPool,
        uint256 _TCR,
        uint256 _price
    )
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        LocalVariables_InnerSingleLiquidateFunction memory vars;
        if (TroveOwners[_asset].length <= 1) {return singleLiquidation;} // don't liquidate if last trove
        (singleLiquidation.entireTroveDebt,
        singleLiquidation.entireTroveColl,
        vars.pendingDebtReward,
        vars.pendingCollReward) = getEntireDebtAndColl(_asset, _borrower);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(_asset, singleLiquidation.entireTroveColl);
        singleLiquidation.kusdGasCompensation = kumoParams.KUSD_GAS_COMPENSATION(_asset);
        vars.collToLiquidate = singleLiquidation.entireTroveColl.sub(singleLiquidation.collGasCompensation);

        // If ICR <= 100%, purely redistribute the Trove across all active Troves
        if (_ICR <= kumoParams._100pct()) {
            _movePendingTroveRewardsToActivePool(_asset, _activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            _removeStake(_asset, _borrower);
           
            singleLiquidation.debtToOffset = 0;
            singleLiquidation.collToSendToSP = 0;
            singleLiquidation.debtToRedistribute = singleLiquidation.entireTroveDebt;
            singleLiquidation.collToRedistribute = vars.collToLiquidate;

            _closeTrove(_asset, _borrower, Status.closedByLiquidation);
            emit TroveLiquidated(_asset, _borrower, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_asset, _borrower, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);
            
        // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > kumoParams._100pct()) && (_ICR < kumoParams.MCR(_asset))) {
             _movePendingTroveRewardsToActivePool(_asset, _activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            _removeStake(_asset, _borrower);

            (singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, vars.collToLiquidate, _KUSDInStabPool);

            _closeTrove(_asset, _borrower, Status.closedByLiquidation);
            emit TroveLiquidated(_asset, _borrower, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_asset, _borrower, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);
        /*
        * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
        * and there is KUSD in the Stability Pool, only offset, with no redistribution,
        * but at a capped rate of 1.1 and only if the whole debt can be liquidated.
        * The remainder due to the capped rate will be claimable as collateral surplus.
        */
        } else if ((_ICR >= kumoParams.MCR(_asset)) && (_ICR < _TCR) && (singleLiquidation.entireTroveDebt <= _KUSDInStabPool)) {
            _movePendingTroveRewardsToActivePool(_asset, _activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            assert(_KUSDInStabPool != 0);

            _removeStake(_asset, _borrower);
            singleLiquidation = _getCappedOffsetVals(_asset, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, _price);

            _closeTrove(_asset,_borrower, Status.closedByLiquidation);
            if (singleLiquidation.collSurplus > 0) {
                collSurplusPool.accountSurplus(_asset, _borrower, singleLiquidation.collSurplus);
            }

            emit TroveLiquidated(_asset, _borrower, singleLiquidation.entireTroveDebt, singleLiquidation.collToSendToSP, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_asset, _borrower, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);

        } else { // if (_ICR >= MCR && ( _ICR >= _TCR || singleLiquidation.entireTroveDebt > _KUSDInStabPool))
            LiquidationValues memory zeroVals;
            return zeroVals;
        }

        return singleLiquidation;
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
    * redistributed to active troves.
    */
    function _getOffsetAndRedistributionVals
    (
        uint256 _debt,
        uint256 _coll,
        uint256 _KUSDInStabPool
    )
        internal
        pure
        returns (uint256 debtToOffset, uint256 collToSendToSP, uint256 debtToRedistribute, uint256 collToRedistribute)
    {
        if (_KUSDInStabPool > 0) {
        /*
        * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        * between all active troves.
        *
        *  If the trove's debt is larger than the deposited KUSD in the Stability Pool:
        *
        *  - Offset an amount of the trove's debt equal to the KUSD in the Stability Pool
        *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
        *
        */
            debtToOffset = KumoMath._min(_debt, _KUSDInStabPool);
            collToSendToSP = _coll.mul(debtToOffset).div(_debt);
            debtToRedistribute = _debt.sub(debtToOffset);
            collToRedistribute = _coll.sub(collToSendToSP);
        } else {
            debtToOffset = 0;
            collToSendToSP = 0;
            debtToRedistribute = _debt;
            collToRedistribute = _coll;
        }
    }

    /*
    *  Get its offset coll/debt and ETH gas comp, and close the trove.
    */
    function _getCappedOffsetVals
    (
        address _asset,
        uint256 _entireTroveDebt,
        uint256 _entireTroveColl,
        uint256 _price
    )
        internal
        view
        returns (LiquidationValues memory singleLiquidation)
    {
        singleLiquidation.entireTroveDebt = _entireTroveDebt;
        singleLiquidation.entireTroveColl = _entireTroveColl;
        uint256 cappedCollPortion = _entireTroveDebt.mul(kumoParams.MCR(_asset)).div(_price);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(_asset, cappedCollPortion);
        singleLiquidation.kusdGasCompensation = kumoParams.KUSD_GAS_COMPENSATION(_asset);

        singleLiquidation.debtToOffset = _entireTroveDebt;
        singleLiquidation.collToSendToSP = cappedCollPortion.sub(singleLiquidation.collGasCompensation);
        singleLiquidation.collSurplus = _entireTroveColl.sub(cappedCollPortion);
        singleLiquidation.debtToRedistribute = 0;
        singleLiquidation.collToRedistribute = 0;
    }

    /*
    * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
    * starting from the one with the lowest collateral ratio in the system, and moving upwards
    */
    function liquidateTroves(address _asset, uint256 _n) external override {
        ContractsCache memory contractsCache = ContractsCache(
            kumoParams.activePool(),
            kumoParams.defaultPool(),
            IKUSDToken(address(0)),
            IKUMOStaking(address(0)),
            sortedTroves,
            ICollSurplusPool(address(0)),
            address(0)
        );
        IStabilityPool stabilityPoolCached = stabilityPoolManager.getAssetStabilityPool(_asset);

        LocalVariables_OuterLiquidationFunction memory vars;

        LiquidationTotals memory totals;

        vars.price = kumoParams.priceFeed().fetchPrice();
        vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

        // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
        if (vars.recoveryModeAtStart) {
            totals = _getTotalsFromLiquidateTrovesSequence_RecoveryMode(_asset, contractsCache, vars.price, vars.KUSDInStabPool, _n);
        } else { // if !vars.recoveryModeAtStart
            totals = _getTotalsFromLiquidateTrovesSequence_NormalMode(_asset ,contractsCache.activePool, contractsCache.defaultPool, vars.price, vars.KUSDInStabPool, _n);
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and KUSD to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(_asset, contractsCache.activePool, contractsCache.defaultPool, totals.totalDebtToRedistribute, totals.totalCollToRedistribute);
        if (totals.totalCollSurplus > 0) {
            contractsCache.activePool.sendAsset(_asset, address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder( _asset, totals.totalCollGasCompensation);

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence.sub(totals.totalCollGasCompensation).sub(totals.totalCollSurplus);
        emit Liquidation(_asset, vars.liquidatedDebt, vars.liquidatedColl, totals.totalCollGasCompensation, totals.totalkusdGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(_asset, contractsCache.activePool, msg.sender, totals.totalkusdGasCompensation, totals.totalCollGasCompensation);
    }

    /*
    * This function is used when the liquidateTroves sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalsFromLiquidateTrovesSequence_RecoveryMode
    (
        address _asset,
        ContractsCache memory _contractsCache,
        uint256 _price,
        uint256 _KUSDInStabPool,
        uint256 _n
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_AssetBorrowerPrice memory assetVars = LocalVariables_AssetBorrowerPrice(
			_asset,
			address(0),
			_price
		);
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt(assetVars._asset);
        vars.entireSystemColl = getEntireSystemColl(assetVars._asset);

        vars.user = _contractsCache.sortedTroves.getLast(assetVars._asset);
        address firstUser = _contractsCache.sortedTroves.getFirst(assetVars._asset);
        for (vars.i = 0; vars.i < _n && vars.user != firstUser; vars.i++) {
            // we need to cache it, because current user is likely going to be deleted
            address nextUser = _contractsCache.sortedTroves.getPrev(assetVars._asset, vars.user);

            vars.ICR = getCurrentICR(assetVars._asset, vars.user, _price);

            if (!vars.backToNormalMode) {
                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= kumoParams.MCR(_asset) && vars.remainingKUSDInStabPool == 0) { break; }

                uint256 TCR = KumoMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                singleLiquidation = _liquidateRecoveryMode(
                    assetVars._asset, _contractsCache.activePool, _contractsCache.defaultPool, vars.user, vars.ICR, vars.remainingKUSDInStabPool, TCR, assetVars._price);

                // Update aggregate trackers
                vars.remainingKUSDInStabPool = vars.remainingKUSDInStabPool.sub(singleLiquidation.debtToOffset);
                vars.entireSystemDebt = vars.entireSystemDebt.sub(singleLiquidation.debtToOffset);
                vars.entireSystemColl = vars.entireSystemColl.
                    sub(singleLiquidation.collToSendToSP).
                    sub(singleLiquidation.collGasCompensation).
                    sub(singleLiquidation.collSurplus);

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(_asset, vars.entireSystemColl, vars.entireSystemDebt, _price);
            }
            else if (vars.backToNormalMode && vars.ICR < kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(assetVars._asset, _contractsCache.activePool, _contractsCache.defaultPool, vars.user, vars.remainingKUSDInStabPool);

                vars.remainingKUSDInStabPool = vars.remainingKUSDInStabPool.sub(singleLiquidation.debtToOffset);

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            }  else break;  // break if the loop reaches a Trove with ICR >= MCR

            vars.user = nextUser;
        }
    }

    function _getTotalsFromLiquidateTrovesSequence_NormalMode
    (
        address _asset,
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _KUSDInStabPool,
        uint256 _n
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;
        ISortedTroves sortedTrovesCached = sortedTroves;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;

        for (vars.i = 0; vars.i < _n; vars.i++) {
            vars.user = sortedTrovesCached.getLast(_asset);
            vars.ICR = getCurrentICR(_asset, vars.user, _price);

            if (vars.ICR < kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(_asset, _activePool, _defaultPool, vars.user, vars.remainingKUSDInStabPool);

                vars.remainingKUSDInStabPool = vars.remainingKUSDInStabPool.sub(singleLiquidation.debtToOffset);

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            } else break;  // break if the loop reaches a Trove with ICR >= MCR
        }
    }

    /*
    * Attempt to liquidate a custom list of troves provided by the caller.
    */
    function batchLiquidateTroves(address _asset, address[] memory _troveArray) public override {
        require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

        IActivePool activePoolCached = kumoParams.activePool();
        IDefaultPool defaultPoolCached = kumoParams.defaultPool();
        IStabilityPool stabilityPoolCached = stabilityPoolManager.getAssetStabilityPool(_asset);

        LocalVariables_OuterLiquidationFunction memory vars;
        LiquidationTotals memory totals;

        vars.price = kumoParams.priceFeed().fetchPrice();
        vars.KUSDInStabPool = stabilityPoolCached.getTotalKUSDDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (vars.recoveryModeAtStart) {
            totals = _getTotalFromBatchLiquidate_RecoveryMode(_asset, activePoolCached, defaultPoolCached, vars.price, vars.KUSDInStabPool, _troveArray);
        } else {  //  if !vars.recoveryModeAtStart
            totals = _getTotalsFromBatchLiquidate_NormalMode(_asset, activePoolCached, defaultPoolCached, vars.price, vars.KUSDInStabPool, _troveArray);
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and KUSD to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(_asset, activePoolCached, defaultPoolCached, totals.totalDebtToRedistribute, totals.totalCollToRedistribute);
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendAsset(_asset, address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(_asset, totals.totalCollGasCompensation);

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence.sub(totals.totalCollGasCompensation).sub(totals.totalCollSurplus);
        emit Liquidation(_asset, vars.liquidatedDebt, vars.liquidatedColl, totals.totalCollGasCompensation, totals.totalkusdGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(_asset, activePoolCached, msg.sender, totals.totalkusdGasCompensation, totals.totalCollGasCompensation);
    }

    /*
    * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalFromBatchLiquidate_RecoveryMode
    (
        address _asset,
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _KUSDInStabPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt(_asset);
        vars.entireSystemColl = getEntireSystemColl(_asset);

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.user = _troveArray[vars.i];
            // Skip non-active troves
            if (Troves[vars.user][_asset].status != Status.active) { continue; }
            vars.ICR = getCurrentICR(_asset, vars.user, _price);

            if (!vars.backToNormalMode) {

                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= kumoParams.MCR(_asset) && vars.remainingKUSDInStabPool == 0) { continue; }

                uint256 TCR = KumoMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                singleLiquidation = _liquidateRecoveryMode(_asset, _activePool, _defaultPool, vars.user, vars.ICR, vars.remainingKUSDInStabPool, TCR, _price);

                // Update aggregate trackers
                vars.remainingKUSDInStabPool = vars.remainingKUSDInStabPool.sub(singleLiquidation.debtToOffset);
                vars.entireSystemDebt = vars.entireSystemDebt.sub(singleLiquidation.debtToOffset);
                vars.entireSystemColl = vars.entireSystemColl.
                    sub(singleLiquidation.collToSendToSP).
                    sub(singleLiquidation.collGasCompensation).
                    sub(singleLiquidation.collSurplus);

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(_asset, vars.entireSystemColl, vars.entireSystemDebt, _price);
            }

            else if (vars.backToNormalMode && vars.ICR < kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(_asset, _activePool, _defaultPool, vars.user, vars.remainingKUSDInStabPool);
                vars.remainingKUSDInStabPool = vars.remainingKUSDInStabPool.sub(singleLiquidation.debtToOffset);

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            } else continue; // In Normal Mode skip troves with ICR >= MCR
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode
    (
        address _asset,
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _KUSDInStabPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingKUSDInStabPool = _KUSDInStabPool;

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.user = _troveArray[vars.i];
            vars.ICR = getCurrentICR(_asset, vars.user, _price);

            if (vars.ICR < kumoParams.MCR(_asset)) {
                singleLiquidation = _liquidateNormalMode(_asset, _activePool, _defaultPool, vars.user, vars.remainingKUSDInStabPool);
                vars.remainingKUSDInStabPool = vars.remainingKUSDInStabPool.sub(singleLiquidation.debtToOffset);

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(LiquidationTotals memory oldTotals, LiquidationValues memory singleLiquidation)
    internal pure returns(LiquidationTotals memory newTotals) {

        // Tally all the values with their respective running totals
        newTotals.totalCollGasCompensation = oldTotals.totalCollGasCompensation.add(singleLiquidation.collGasCompensation);
        newTotals.totalkusdGasCompensation = oldTotals.totalkusdGasCompensation.add(singleLiquidation.kusdGasCompensation);
        newTotals.totalDebtInSequence = oldTotals.totalDebtInSequence.add(singleLiquidation.entireTroveDebt);
        newTotals.totalCollInSequence = oldTotals.totalCollInSequence.add(singleLiquidation.entireTroveColl);
        newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset.add(singleLiquidation.debtToOffset);
        newTotals.totalCollToSendToSP = oldTotals.totalCollToSendToSP.add(singleLiquidation.collToSendToSP);
        newTotals.totalDebtToRedistribute = oldTotals.totalDebtToRedistribute.add(singleLiquidation.debtToRedistribute);
        newTotals.totalCollToRedistribute = oldTotals.totalCollToRedistribute.add(singleLiquidation.collToRedistribute);
        newTotals.totalCollSurplus = oldTotals.totalCollSurplus.add(singleLiquidation.collSurplus);

        return newTotals;
    }

    function _sendGasCompensation(address _asset, IActivePool _activePool, address _liquidator, uint256 _KUSD, uint256 _amount) internal {
        // Before calling this function, we always check that something was liquidated, otherwise revert.
        // KUSD gas compensation could then only be zero if we set to zero that constant, but it’s ok to have this here as a sanity check
        if (_KUSD > 0) {
            kusdToken.returnFromPool(gasPoolAddress, _liquidator, _KUSD);
        }

        // ETH gas compensation could only be zero if all liquidated troves in the sequence had collateral lower than 200 Wei
        // (see _getCollGasCompensation function in KumoBase)
        // With the current values of min debt this seems quite unlikely, unless ETH price was in the order of magnitude of $10^19 or more,
        // but it’s ok to have this here as a sanity check
        if (_amount > 0) {
            _activePool.sendAsset(_asset, _liquidator, _amount);
        }
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(address _asset, IActivePool _activePool, IDefaultPool _defaultPool, uint256 _KUSD, uint256 _amount) internal {
        _defaultPool.decreaseKUSDDebt(_asset, _KUSD);
        _activePool.increaseKUSDDebt(_asset, _KUSD);
        _defaultPool.sendAssetToActivePool(_asset, _amount);
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's Trove in exchange for KUSD up to _maxKUSDamount
    function _redeemCollateralFromTrove(
        address _asset,
        ContractsCache memory _contractsCache,
        address _borrower,
        uint256 _maxKUSDamount,
        uint256 _price,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR
    )
        internal returns (SingleRedemptionValues memory singleRedemption)
    {
        LocalVariables_AssetBorrowerPrice memory vars = LocalVariables_AssetBorrowerPrice(
			_asset,
			_borrower,
			_price
		);
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        singleRedemption.KUSDLot = KumoMath._min(_maxKUSDamount, Troves[_borrower][vars._asset].debt.sub(kumoParams.KUSD_GAS_COMPENSATION(_asset)));

        // Get the ETHLot of equivalent value in USD
        singleRedemption.ETHLot = singleRedemption.KUSDLot.mul(DECIMAL_PRECISION).div(_price);

        // Decrease the debt and collateral of the current Trove according to the KUSD lot and corresponding ETH to send
        uint256 newDebt = (Troves[vars._borrower][vars._asset].debt).sub(singleRedemption.KUSDLot);
        uint256 newColl = (Troves[vars._borrower][vars._asset].coll).sub(singleRedemption.ETHLot);

        if (newDebt == kumoParams.KUSD_GAS_COMPENSATION(vars._asset)) {
            // No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
            _removeStake(vars._asset,vars._borrower);
            _closeTrove(vars._asset, vars._borrower, Status.closedByRedemption);
            _redeemCloseTrove(vars._asset, _contractsCache, vars._borrower, kumoParams.KUSD_GAS_COMPENSATION(vars._asset), newColl);
            emit TroveUpdated(vars._asset, vars._borrower, 0, 0, 0, TroveManagerOperation.redeemCollateral);

        } else {
            uint256 newNICR = KumoMath._computeNominalCR(newColl, newDebt);

            /*
            * If the provided hint is out of date, we bail since trying to reinsert without a good hint will almost
            * certainly result in running out of gas. 
            *
            * If the resultant net debt of the partial is less than the minimum, net debt we bail.
            */
            if (newNICR != _partialRedemptionHintNICR || _getNetDebt(vars._asset, newDebt) < kumoParams.MIN_NET_DEBT(vars._asset)) {
                singleRedemption.cancelledPartial = true;
                return singleRedemption;
            }

            _contractsCache.sortedTroves.reInsert(vars._asset, vars._borrower, newNICR, _upperPartialRedemptionHint, _lowerPartialRedemptionHint);

            Troves[vars._borrower][vars._asset].debt = newDebt;
            Troves[vars._borrower][vars._asset].coll = newColl;
            _updateStakeAndTotalStakes(vars._asset, vars._borrower);

            emit TroveUpdated(
                vars._asset,
                vars._borrower,
                newDebt, newColl,
                Troves[vars._borrower][vars._asset].stake,
                TroveManagerOperation.redeemCollateral
            );
        }

        return singleRedemption;
    }

    /*
    * Called when a full redemption occurs, and closes the trove.
    * The redeemer swaps (debt - liquidation reserve) KUSD for (debt - liquidation reserve) worth of ETH, so the KUSD liquidation reserve left corresponds to the remaining debt.
    * In order to close the trove, the KUSD liquidation reserve is burned, and the corresponding debt is removed from the active pool.
    * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
    * Any surplus ETH left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
    */
    function _redeemCloseTrove(address _asset, ContractsCache memory _contractsCache, address _borrower, uint256 _KUSD, uint256 _amount) internal {
        _contractsCache.kusdToken.burn(gasPoolAddress, _KUSD);
        // Update Active Pool KUSD, and send ETH to account
        _contractsCache.activePool.decreaseKUSDDebt(_asset,_KUSD);

        // send ETH from Active Pool to CollSurplus Pool
        _contractsCache.collSurplusPool.accountSurplus(_asset, _borrower, _amount);
        _contractsCache.activePool.sendAsset(_asset, address(_contractsCache.collSurplusPool), _amount);
    }

    function _isValidFirstRedemptionHint(address _asset, ISortedTroves _sortedTroves, address _firstRedemptionHint, uint256 _price) internal view returns (bool) {
        if (_firstRedemptionHint == address(0) ||
            !_sortedTroves.contains(_asset, _firstRedemptionHint) ||
            getCurrentICR(_asset, _firstRedemptionHint, _price) < kumoParams.MCR(_asset)
        ) {
            return false;
        }

        address nextTrove = _sortedTroves.getNext(_asset, _firstRedemptionHint);
        return nextTrove == address(0) || getCurrentICR(_asset, nextTrove, _price) < kumoParams.MCR(_asset);
    }

    /* Send _KUSDamount KUSD to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
    * request.  Applies pending rewards to a Trove before reducing its debt and coll.
    *
    * Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by
    * splitting the total _amount in appropriate chunks and calling the function multiple times.
    *
    * Param `_maxIterations` can also be provided, so the loop through Troves is capped (if it’s zero, it will be ignored).This makes it easier to
    * avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology”
    * of the trove list. It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode
    * costs can vary.
    *
    * All Troves that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed.
    * If the last Trove does have some remaining debt, it has a finite ICR, and the reinsertion could be anywhere in the list, therefore it requires a hint.
    * A frontend should use getRedemptionHints() to calculate what the ICR of this Trove will be after redemption, and pass a hint for its position
    * in the sortedTroves list along with the ICR value that the hint was found for.
    *
    * If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
    * is very likely that the last (partially) redeemed Trove would end up with a different ICR than what the hint is for. In this case the
    * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining KUSD amount, which they can attempt
    * to redeem later.
    */
    function redeemCollateral(
        address _asset,
        uint256 _KUSDamount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFeePercentage
    )
        external
        override
    {
        // require(
		// 	block.timestamp >= kumoParams.redemptionBlock(_asset),
		// 	"TroveManager: Redemption is blocked"
		// );
        ContractsCache memory contractsCache = ContractsCache(
            kumoParams.activePool(),
            kumoParams.defaultPool(),
            kusdToken,
            kumoStaking,
            sortedTroves,
            collSurplusPool,
            gasPoolAddress
        );
        RedemptionTotals memory totals;

        _requireValidMaxFeePercentage(_asset, _maxFeePercentage);
        _requireAfterBootstrapPeriod();
        totals.price = kumoParams.priceFeed().fetchPrice();
        _requireTCRoverMCR(_asset, totals.price);
        _requireAmountGreaterThanZero(_KUSDamount);
        _requireKUSDBalanceCoversRedemption(contractsCache.kusdToken, msg.sender, _KUSDamount);

        totals.totalKUSDSupplyAtStart = getEntireSystemDebt(_asset);
        // Confirm redeemer's balance is less than total KUSD supply
        assert(contractsCache.kusdToken.balanceOf(msg.sender) <= totals.totalKUSDSupplyAtStart);

        totals.remainingKUSD = _KUSDamount;
        address currentBorrower;

        if (_isValidFirstRedemptionHint(_asset, contractsCache.sortedTroves, _firstRedemptionHint, totals.price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = contractsCache.sortedTroves.getLast(_asset);
            // Find the first trove with ICR >= MCR
            while (currentBorrower != address(0) && getCurrentICR(_asset, currentBorrower, totals.price) < kumoParams.MCR(_asset)) {
                currentBorrower = contractsCache.sortedTroves.getPrev(_asset, currentBorrower);
            }
        }

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of KUSD is exchanged for collateral
        if (_maxIterations == 0) { _maxIterations = type(uint256).max; }
        while (currentBorrower != address(0) && totals.remainingKUSD > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = contractsCache.sortedTroves.getPrev(_asset, currentBorrower);

            _applyPendingRewards(_asset, contractsCache.activePool, contractsCache.defaultPool, currentBorrower);

            SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
                _asset,
                contractsCache,
                currentBorrower,
                totals.remainingKUSD,
                totals.price,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint,
                _partialRedemptionHintNICR
            );

            if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

            totals.totalKUSDToRedeem  = totals.totalKUSDToRedeem.add(singleRedemption.KUSDLot);
            totals.totalETHDrawn = totals.totalETHDrawn.add(singleRedemption.ETHLot);

            totals.remainingKUSD = totals.remainingKUSD.sub(singleRedemption.KUSDLot);
            currentBorrower = nextUserToCheck;
        }
        require(totals.totalETHDrawn > 0, "TroveManager: Unable to redeem any amount");

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total KUSD supply value, from before it was reduced by the redemption.
        _updateBaseRateFromRedemption(_asset, totals.totalETHDrawn, totals.price, totals.totalKUSDSupplyAtStart);

        // Calculate the ETH fee
        totals.ETHFee = _getRedemptionFee(_asset, totals.totalETHDrawn);

        _requireUserAcceptsFee(totals.ETHFee, totals.totalETHDrawn, _maxFeePercentage);

        // Send the ETH fee to the KUMO staking contract
        contractsCache.activePool.sendAsset(_asset, address(contractsCache.kumoStaking), totals.ETHFee);
        contractsCache.kumoStaking.increaseF_Asset(_asset, totals.ETHFee);

        totals.ETHToSendToRedeemer = totals.totalETHDrawn.sub(totals.ETHFee);

        emit Redemption(_asset, _KUSDamount, totals.totalKUSDToRedeem, totals.totalETHDrawn, totals.ETHFee);

        // Burn the total KUSD that is cancelled with debt, and send the redeemed ETH to msg.sender
        contractsCache.kusdToken.burn(msg.sender, totals.totalKUSDToRedeem);
        // Update Active Pool KUSD, and send ETH to account
        contractsCache.activePool.decreaseKUSDDebt(_asset, totals.totalKUSDToRedeem);
        contractsCache.activePool.sendAsset(_asset, msg.sender, totals.ETHToSendToRedeemer);
    }

    // --- Helper functions ---

    // Return the nominal collateral ratio (ICR) of a given Trove, without the price. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getNominalICR(address _asset, address _borrower) public view override returns (uint256) {
        (uint256 currentETH, uint256 currentKUSDDebt) = _getCurrentTroveAmounts(_asset, _borrower);

        uint256 NICR = KumoMath._computeNominalCR(currentETH, currentKUSDDebt);
        return NICR;
    }

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(address _asset, address _borrower, uint256 _price) public view override returns (uint256) {
        (uint256 currentETH, uint256 currentKUSDDebt) = _getCurrentTroveAmounts(_asset, _borrower);

        uint256 ICR = KumoMath._computeCR(currentETH, currentKUSDDebt, _price);
        return ICR;
    }

    function _getCurrentTroveAmounts(address _asset, address _borrower) internal view returns (uint256, uint256) {
        uint256 pendingReward = getPendingReward(_asset, _borrower);
        uint256 pendingKUSDDebtReward = getPendingKUSDDebtReward(_asset, _borrower);

        uint256 currentAsset = Troves[_borrower][_asset].coll.add(pendingReward);
        uint256 currentKUSDDebt = Troves[_borrower][_asset].debt.add(pendingKUSDDebtReward);

        return (currentAsset, currentKUSDDebt);
    }

    function applyPendingRewards(address _asset, address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _applyPendingRewards(_asset, kumoParams.activePool(), kumoParams.defaultPool(), _borrower);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _applyPendingRewards(address _asset, IActivePool _activePool, IDefaultPool _defaultPool, address _borrower) internal {
        if (hasPendingRewards(_asset, _borrower)) {
            _requireTroveIsActive(_asset, _borrower);

            // Compute pending rewards
            uint256 pendingReward = getPendingReward(_asset, _borrower);
            uint256 pendingKUSDDebtReward = getPendingKUSDDebtReward(_asset, _borrower);

            // Apply pending rewards to trove's state
            Troves[_borrower][_asset].coll = Troves[_borrower][_asset].coll.add(pendingReward);
            Troves[_borrower][_asset].debt = Troves[_borrower][_asset].debt.add(pendingKUSDDebtReward);

            _updateTroveRewardSnapshots(_asset, _borrower);

            // Transfer from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(_asset, _activePool, _defaultPool, pendingKUSDDebtReward, pendingReward);

            emit TroveUpdated(
                _asset,
                _borrower,
                Troves[_borrower][_asset].debt,
                Troves[_borrower][_asset].coll,
                Troves[_borrower][_asset].stake,
                TroveManagerOperation.applyPendingRewards
            );
        }
    }

    // Update borrower's snapshots of L_ASSETS and L_KUSDDebt to reflect the current values
    function updateTroveRewardSnapshots(address _asset, address _borrower) external override {
        _requireCallerIsBorrowerOperations();
       return _updateTroveRewardSnapshots(_asset, _borrower);
    }

    function _updateTroveRewardSnapshots(address _asset, address _borrower) internal {
        rewardSnapshots[_borrower][_asset].asset = L_ASSETS[_asset];
		rewardSnapshots[_borrower][_asset].KUSDDebt = L_KUSDDebts[_asset];
		emit TroveSnapshotsUpdated(_asset, L_ASSETS[_asset], L_KUSDDebts[_asset]);
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingReward(address _asset, address _borrower) public view override returns (uint256) {
		uint256 snapshotAsset = rewardSnapshots[_borrower][_asset].asset;
		uint256 rewardPerUnitStaked = L_ASSETS[_asset].sub(snapshotAsset);
		if (rewardPerUnitStaked == 0 || !isTroveActive(_asset, _borrower)) {
			return 0;
		}
		uint256 stake = Troves[_borrower][_asset].stake;
		uint256 pendingAssetReward = stake.mul(rewardPerUnitStaked).div(DECIMAL_PRECISION);
		return pendingAssetReward;
    }
    
    // Get the borrower's pending accumulated KUSD reward, earned by their stake
    function getPendingKUSDDebtReward(address _asset, address _borrower) public view override returns (uint256) {
        uint256 snapshotKUSDDebt = rewardSnapshots[_borrower][_asset].KUSDDebt;
        uint256 rewardPerUnitStaked = L_KUSDDebts[_asset].sub(snapshotKUSDDebt);

        if ( rewardPerUnitStaked == 0 || !isTroveActive(_asset, _borrower)) { return 0; }

        uint256 stake =  Troves[_borrower][_asset].stake;

        uint256 pendingKUSDDebtReward = stake.mul(rewardPerUnitStaked).div(DECIMAL_PRECISION);

        return pendingKUSDDebtReward;
    }

    function hasPendingRewards(address _asset, address _borrower) public view override returns (bool) {
        /*
        * A Trove has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * pending rewards
        */
		if (!isTroveActive(_asset, _borrower)) {
			return false;
		}

		return (rewardSnapshots[_borrower][_asset].asset < L_ASSETS[_asset]);
    }

    // Return the Troves entire debt and coll, including pending rewards from redistributions.
    function getEntireDebtAndColl(
        address _asset,
        address _borrower
    )
        public
        view
        override
        returns (uint256 debt, uint256 coll, uint256 pendingKUSDDebtReward, uint256 pendingReward)
    {
        debt = Troves[_borrower][_asset].debt;
        coll = Troves[_borrower][_asset].coll;

        pendingKUSDDebtReward = getPendingKUSDDebtReward(_asset,_borrower);
        pendingReward = getPendingReward(_asset, _borrower);

        debt = debt.add(pendingKUSDDebtReward);
        coll = coll.add(pendingReward);
    }

    function removeStake(address _asset, address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_asset, _borrower);
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _asset, address _borrower) internal {
		uint256 stake = Troves[_borrower][_asset].stake;
		totalStakes[_asset] = totalStakes[_asset].sub(stake);
		Troves[_borrower][_asset].stake = 0;
    }

    function updateStakeAndTotalStakes(address _asset, address _borrower) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_asset, _borrower);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(address _asset, address _borrower) internal returns (uint256) {
		uint256 newStake = _computeNewStake(_asset, Troves[_borrower][_asset].coll);
		uint256 oldStake = Troves[_borrower][_asset].stake;
		Troves[_borrower][_asset].stake = newStake;

		totalStakes[_asset] = totalStakes[_asset].sub(oldStake).add(newStake);
		emit TotalStakesUpdated(_asset, totalStakes[_asset]);

        return newStake;
    }

    // Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
    function _computeNewStake(address _asset, uint256 _coll) internal view returns (uint256) {
        uint256 stake;
        if (totalCollateralSnapshot[_asset] == 0) {
            stake = _coll;
        } else {
            /*
            * The following assert() holds true because:
            * - The system always contains >= 1 trove
            * - When we close or liquidate a trove, we redistribute the pending rewards, so if all troves were closed/liquidated,
            * rewards would’ve been emptied and totalCollateralSnapshot would be zero too.
            */
            assert(totalStakesSnapshot[_asset] > 0);
            stake = _coll.mul(totalStakesSnapshot[_asset]).div(totalCollateralSnapshot[_asset]);
        }
        return stake;
    }

    function _redistributeDebtAndColl(address _asset, IActivePool _activePool, IDefaultPool _defaultPool, uint256 _debt, uint256 _coll) internal {
        if (_debt == 0) { return; }

        /*
        * Add distributed coll and debt rewards-per-unit-staked to the running totals. Division uses a "feedback"
        * error correction, to keep the cumulative error low in the running totals L_ASSETS and L_KUSDDebt:
        *
        * 1) Form numerators which compensate for the floor division errors that occurred the last time this
        * function was called.
        * 2) Calculate "per-unit-staked" ratios.
        * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
        * 4) Store these errors for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint256 ETHNumerator = _coll.mul(DECIMAL_PRECISION).add(lastETHError_Redistribution[_asset]);
        uint256 KUSDDebtNumerator = _debt.mul(DECIMAL_PRECISION).add(lastKUSDDebtError_Redistribution[_asset]);

        // Get the per-unit-staked terms
        uint256 ETHRewardPerUnitStaked = ETHNumerator.div(totalStakes[_asset]);
        uint256 KUSDDebtRewardPerUnitStaked = KUSDDebtNumerator.div(totalStakes[_asset]);

        lastETHError_Redistribution[_asset] = ETHNumerator.sub(ETHRewardPerUnitStaked.mul(totalStakes[_asset]));
        lastKUSDDebtError_Redistribution[_asset] = KUSDDebtNumerator.sub(KUSDDebtRewardPerUnitStaked.mul(totalStakes[_asset]));

        // Add per-unit-staked terms to the running totals
        L_ASSETS[_asset] = L_ASSETS[_asset].add(ETHRewardPerUnitStaked);
        L_KUSDDebts[_asset] = L_KUSDDebts[_asset].add(KUSDDebtRewardPerUnitStaked);

        emit LTermsUpdated(L_ASSETS[_asset], L_KUSDDebts[_asset]);

        // Transfer coll and debt from ActivePool to DefaultPool
        _activePool.decreaseKUSDDebt(_asset, _debt);
        _defaultPool.increaseKUSDDebt(_asset, _debt);
        _activePool.sendAsset(_asset, address(_defaultPool), _coll);
    }

    function closeTrove(address _asset, address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _closeTrove(_asset, _borrower, Status.closedByOwner);
    }

    function _closeTrove(address _asset, address _borrower, Status closedStatus) internal {
        assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

		uint256 TroveOwnersArrayLength = TroveOwners[_asset].length;
		_requireMoreThanOneTroveInSystem(_asset, TroveOwnersArrayLength);

		Troves[_borrower][_asset].status = closedStatus;
		Troves[_borrower][_asset].coll = 0;
		Troves[_borrower][_asset].debt = 0;

		rewardSnapshots[_borrower][_asset].asset = 0;
		rewardSnapshots[_borrower][_asset].KUSDDebt = 0;

		_removeTroveOwner(_asset, _borrower, TroveOwnersArrayLength);
		sortedTroves.remove(_asset, _borrower);
    }

    /*
    * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
    * Used in a liquidation sequence.
    *
    * The calculation excludes a portion of collateral that is in the ActivePool:
    *
    * the total ETH gas compensation from the liquidation sequence
    *
    * The ETH as compensation must be excluded as it is always sent out at the very end of the liquidation sequence.
    */
    function _updateSystemSnapshots_excludeCollRemainder(address _asset, uint256 _collRemainder) internal {
        totalStakesSnapshot[_asset] = totalStakes[_asset];

        uint256 activeColl = kumoParams.activePool().getAssetBalance(_asset);
        uint256 liquidatedColl = kumoParams.defaultPool().getAssetBalance(_asset);
        totalCollateralSnapshot[_asset] = activeColl.sub(_collRemainder).add(liquidatedColl);

        emit SystemSnapshotsUpdated(_asset, totalStakesSnapshot[_asset], totalCollateralSnapshot[_asset]);
    }

    // Push the owner's address to the Trove owners list, and record the corresponding array index on the Trove struct
    function addTroveOwnerToArray(address _asset, address _borrower) external override returns (uint256 index) {
        _requireCallerIsBorrowerOperations();
        return _addTroveOwnerToArray(_asset, _borrower);
    }

    function _addTroveOwnerToArray(address _asset, address _borrower) internal returns (uint128 index) {
        /* Max array size is 2**128 - 1, i.e. ~3e30 troves. No risk of overflow, since troves have minimum KUSD
        debt of liquidation reserve plus MIN_NET_DEBT. 3e30 KUSD dwarfs the value of all wealth in the world ( which is < 1e15 USD). */

        // Push the Troveowner to the array
        TroveOwners[_asset].push(_borrower);

        // Record the index of the new Troveowner on their Trove struct
        index = uint128(TroveOwners[_asset].length.sub(1));
        Troves[_borrower][_asset].arrayIndex = index;

        return index;
    }

    /*
    * Remove a Trove owner from the TroveOwners array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
    */
    function _removeTroveOwner(address _asset, address _borrower, uint256 TroveOwnersArrayLength) internal {
        Status troveStatus = Troves[_borrower][_asset].status;
        // It’s set in caller function `_closeTrove`
        assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

        uint128 index = Troves[_borrower][_asset].arrayIndex;
        uint256 length = TroveOwnersArrayLength;
        uint256 idxLast = length.sub(1);

        assert(index <= idxLast);

        address addressToMove = TroveOwners[_asset][idxLast];

        TroveOwners[_asset][index] = addressToMove;
        Troves[addressToMove][_asset].arrayIndex = index;
        emit TroveIndexUpdated(_asset, addressToMove, index);

        TroveOwners[_asset].pop();
    }

    // --- Recovery Mode and TCR functions ---

    function getTCR(address _asset, uint256 _price) external view override returns (uint256) {
        return _getTCR(_asset, _price);
    }

    function checkRecoveryMode (address _asset, uint256 _price) external view override returns (bool) {
        return _checkRecoveryMode(_asset, _price);
    }

    // Check whether or not the system *would be* in Recovery Mode, given an ETH:USD price, and the entire system coll and debt.
    function _checkPotentialRecoveryMode(
        address  _asset,
        uint256 _entireSystemColl,
        uint256 _entireSystemDebt,
        uint256 _price
    )
        internal
        view
    returns (bool)
    {
        uint256 TCR = KumoMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);

        return TCR < kumoParams.CCR(_asset);
    }

    // --- Redemption fee functions ---

    /*
    * This function has two impacts on the baseRate state variable:
    * 1) decays the baseRate based on time passed since last redemption or KUSD borrowing operation.
    * then,
    * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
    */
    function _updateBaseRateFromRedemption(address _asset, uint256 _amountDrawn,  uint256 _price, uint256 _totalKUSDSupply) internal returns (uint256) {
        uint256 decayedBaseRate = _calcDecayedBaseRate(_asset);

        /* Convert the drawn ETH back to KUSD at face value rate (1 KUSD:1 USD), in order to get
        * the fraction of total supply that was redeemed at face value. */
        uint256 redeemedKUSDFraction = _amountDrawn.mul(_price).div(_totalKUSDSupply);

        uint256 newBaseRate = decayedBaseRate.add(redeemedKUSDFraction.div(BETA));
        newBaseRate = KumoMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%
        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in the line above
        assert(newBaseRate > 0); // Base rate is always non-zero after redemption

        // Update the baseRate state variable
        baseRate[_asset] = newBaseRate;
        emit BaseRateUpdated(_asset, newBaseRate);
        
        _updateLastFeeOpTime(_asset);

        return newBaseRate;
    }

	function getRedemptionRateWithDecay(address _asset) public view override returns (uint256) {
		return _calcRedemptionRate(_asset, _calcDecayedBaseRate(_asset));
	}

	function getRedemptionRate(address _asset) public view override returns (uint256) {
		return _calcRedemptionRate(_asset, baseRate[_asset]);
	}

    function _getRedemptionFee(address _asset, uint256 _assetDraw) internal view returns (uint256) {
        return _calcRedemptionFee(getRedemptionRate(_asset), _assetDraw);
    }

    function getRedemptionFeeWithDecay(address _asset, uint256 _assetDraw) external view returns (uint256){
        return _calcRedemptionFee(getRedemptionRateWithDecay(_asset), _assetDraw);
    }

    function _calcRedemptionFee(uint256 _redemptionRate, uint256 _assetDraw)
		internal
		pure
		returns (uint256)
	{
		uint256 redemptionFee = _redemptionRate.mul(_assetDraw).div(DECIMAL_PRECISION);
		require(
			redemptionFee < _assetDraw,
			"TroveManager: Fee would eat up all returned collateral"
		);
		return redemptionFee;
	}

	function _calcRedemptionRate(address _asset, uint256 _baseRate) internal view returns (uint256)
	{
		return KumoMath._min(
				kumoParams.REDEMPTION_FEE_FLOOR(_asset).add(_baseRate),
				DECIMAL_PRECISION
			);
	}

    // --- Borrowing fee functions ---

    function getBorrowingRate(address _asset) public view override returns (uint256) {
        return _calcBorrowingRate(_asset, baseRate[_asset]);
    }

    function getBorrowingRateWithDecay(address _asset) public view returns (uint256) {
        return _calcBorrowingRate(_asset,_calcDecayedBaseRate(_asset));
    }

    function _calcBorrowingRate(address _asset, uint256 _baseRate) internal view returns (uint256) {
        return KumoMath._min(
            kumoParams.BORROWING_FEE_FLOOR(_asset).add(_baseRate),
            kumoParams.MAX_BORROWING_FEE(_asset)
        );
    }

    function getBorrowingFee(address _asset, uint256 _KUSDDebt) external view override returns (uint256) {
        return _calcBorrowingFee(getBorrowingRate(_asset), _KUSDDebt);
    }

    function getBorrowingFeeWithDecay(address _asset, uint256 _KUSDDebt) external view override returns (uint256) {
        return _calcBorrowingFee(getBorrowingRateWithDecay(_asset), _KUSDDebt);
    }

    function _calcBorrowingFee(uint256 _borrowingRate, uint256 _KUSDDebt) internal pure returns (uint256) {
        return _borrowingRate.mul(_KUSDDebt).div(DECIMAL_PRECISION);
    }


    // Updates the baseRate state variable based on time elapsed since the last redemption or KUSD borrowing operation.
    function decayBaseRateFromBorrowing(address _asset) external override {
        _requireCallerIsBorrowerOperations();

        uint256 decayedBaseRate = _calcDecayedBaseRate(_asset);
        assert(decayedBaseRate <= DECIMAL_PRECISION);  // The baseRate can decay to 0

        baseRate[_asset] = decayedBaseRate;
        emit BaseRateUpdated(decayedBaseRate);

        _updateLastFeeOpTime(_asset);
    }

    // --- Internal fee functions ---

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime(address _asset) internal {
        uint256 timePassed = block.timestamp.sub(lastFeeOperationTime[_asset]);

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            lastFeeOperationTime[_asset] = block.timestamp;
            emit LastFeeOpTimeUpdated(_asset ,block.timestamp);
        }
    }

    function _calcDecayedBaseRate(address _asset) internal view returns (uint256) {
        uint256 minutesPassed = _minutesPassedSinceLastFeeOp(_asset);
        uint256 decayFactor = KumoMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate[_asset].mul(decayFactor).div(DECIMAL_PRECISION);
    }

    function _minutesPassedSinceLastFeeOp(address _asset) internal view returns (uint256) {
        return (block.timestamp.sub(lastFeeOperationTime[_asset])).div(SECONDS_IN_ONE_MINUTE);
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "TroveManager: Caller is not the BorrowerOperations contract");
    }

    function _requireTroveIsActive(address _asset, address _borrower) internal view {
        require(Troves[_borrower][_asset].status == Status.active, "TroveManager: Trove does not exist or is closed");
    }

    function _requireKUSDBalanceCoversRedemption(IKUSDToken _kusdToken, address _redeemer, uint256 _amount) internal view {
        require(_kusdToken.balanceOf(_redeemer) >= _amount, "TroveManager: Requested redemption amount must be <= user's KUSD token balance");
    }

    function _requireMoreThanOneTroveInSystem(address _asset, uint256 TroveOwnersArrayLength) internal view {
        require (TroveOwnersArrayLength > 1 && sortedTroves.getSize(_asset) > 1, "TroveManager: Only one trove in the system");
    }

    function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
        require(_amount > 0, "TroveManager: Amount must be greater than zero");
    }

    function _requireTCRoverMCR(address _asset, uint256 _price) internal view {
        require(_getTCR(_asset, _price) >= kumoParams.MCR(_asset), "TroveManager: Cannot redeem when TCR < MCR");
    }

    function _requireAfterBootstrapPeriod() internal view {
        uint256 systemDeploymentTime = kumoToken.getDeploymentStartTime();
        require(block.timestamp >= systemDeploymentTime.add(kumoParams.BOOTSTRAP_PERIOD()), "TroveManager: Redemptions are not allowed during bootstrap phase");
    }

    function _requireValidMaxFeePercentage(address _asset, uint256 _maxFeePercentage) internal view {
        require(_maxFeePercentage >= kumoParams.REDEMPTION_FEE_FLOOR(_asset)  && _maxFeePercentage <= DECIMAL_PRECISION,
            "Max fee percentage must be between 0.5% and 100%");
    }

    // --- Trove property getters ---
    function isTroveActive(address _asset, address _borrower) internal view returns (bool) {
		return this.getTroveStatus(_asset, _borrower) == uint256(Status.active);
	}

    function getTroveStatus(address _asset, address _borrower) external view override returns (uint256) {
        return uint256(Troves[_borrower][_asset].status);
    }

    function getTroveStake(address _asset, address _borrower) external view override returns (uint256) {
        return Troves[_borrower][_asset].stake;
    }

    function getTroveDebt(address _asset, address _borrower) external view override returns (uint256) {
        return Troves[_borrower][_asset].debt;
    }

    function getTroveColl(address _asset, address _borrower) external view override returns (uint256) {
        return Troves[_borrower][_asset].coll;
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function setTroveStatus(address _asset, address _borrower, uint256 _num) external override {
        _requireCallerIsBorrowerOperations();
        Troves[_borrower][_asset].asset = _asset;
		Troves[_borrower][_asset].status = Status(_num);
    }

    function increaseTroveColl(address _asset, address _borrower, uint256 _collIncrease) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newColl = Troves[_borrower][_asset].coll.add(_collIncrease);
		Troves[_borrower][_asset].coll = newColl;
		return newColl;
    }

    function decreaseTroveColl(address _asset, address _borrower, uint256 _collDecrease) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newColl = Troves[_borrower][_asset].coll.sub(_collDecrease);
		Troves[_borrower][_asset].coll = newColl;
		return newColl;
    }

    function increaseTroveDebt(address _asset, address _borrower, uint256 _debtIncrease) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newDebt = Troves[_borrower][_asset].debt.add(_debtIncrease);
		Troves[_borrower][_asset].debt = newDebt;
		return newDebt;
    }

    function decreaseTroveDebt(address _asset, address _borrower, uint256 _debtDecrease) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        uint256 newDebt = Troves[_borrower][_asset].debt.sub(_debtDecrease);
		Troves[_borrower][_asset].debt = newDebt;
		return newDebt;
    }
}
