// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManagerDiamond.sol";
import "./Interfaces/IKUSDToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IKUMOStaking.sol";
import "./Interfaces/IStabilityPoolFactory.sol";
import "./Dependencies/KumoBase.sol";
import "./Dependencies/CheckContract.sol";
import "hardhat/console.sol";

import "./Dependencies/SafeMath.sol";
import "./Dependencies/SafetyTransfer.sol";

contract BorrowerOperations is KumoBase, CheckContract, IBorrowerOperations {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    string public constant NAME = "BorrowerOperations";
    // bool public isInitialized;
    // --- Connected contract declarations ---

    ITroveManagerDiamond public troveManager;

    IStabilityPoolFactory public stabilityPoolFactory;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IKUMOStaking public kumoStaking;
    address public kumoStakingAddress;

    IKUSDToken public kusdToken;

    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

    struct LocalVariables_adjustTrove {
        address asset;
        uint256 price;
        uint256 collChange;
        uint256 netDebtChange;
        bool isCollIncrease;
        uint256 debt;
        uint256 coll;
        uint256 oldICR;
        uint256 newICR;
        uint256 newTCR;
        uint256 KUSDFee;
        uint256 newDebt;
        uint256 newColl;
        uint256 stake;
    }

    struct LocalVariables_openTrove {
        address asset;
        uint256 price;
        uint256 KUSDFee;
        uint256 netDebt;
        uint256 compositeDebt;
        uint256 ICR;
        uint256 NICR;
        uint256 stake;
        uint256 arrayIndex;
    }

    struct ContractsCache {
        ITroveManagerDiamond troveManager;
        IActivePool activePool;
        IKUSDToken kusdToken;
    }

    enum BorrowerOperation {
        openTrove,
        closeTrove,
        adjustTrove
    }

    event TroveUpdated(
        address indexed _asset,
        address indexed _borrower,
        uint256 _debt,
        uint256 _coll,
        uint256 stake,
        BorrowerOperation operation
    );
    // event TroveManagerAddressChanged(address _newTroveManagerAddress);
    // event ActivePoolAddressChanged(address _activePoolAddress);
    // event DefaultPoolAddressChanged(address _defaultPoolAddress);
    // event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    // event GasPoolAddressChanged(address _gasPoolAddress);
    // event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    // event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    // event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    // event KUSDTokenAddressChanged(address _kusdTokenAddress);
    // event KUMOStakingAddressChanged(address _kumoStakingAddress);

    // event TroveCreated(address indexed _borrower, uint256 arrayIndex);
    // event TroveUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint256 stake, BorrowerOperation operation);
    // event KUSDBorrowingFeePaid(address indexed _borrower, uint256 _KUSDFee);

    // --- Dependency setters ---

    modifier assetIsInitialized(address _asset) {
        require(
            kumoParams.hasCollateralConfigured(_asset) == true,
            "BorrowerOp: asset is not initialized"
        );
        _;
    }

    function setAddresses(
        address _troveManagerAddress,
        address _stabilityPoolFactoryAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _sortedTrovesAddress,
        address _kusdTokenAddress,
        address _kumoStakingAddress,
        address _kumoParamsAddress
    ) external override onlyOwner {
        // This makes impossible to open a trove with zero withdrawn KUSD
        assert(MIN_NET_DEBT > 0);
        // require(!isInitialized, "Already initialized");
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolFactoryAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_kusdTokenAddress);
        checkContract(_kumoStakingAddress);
        checkContract(_kumoParamsAddress);
        // isInitialized = true;

        // __Ownable_init();

        troveManager = ITroveManagerDiamond(_troveManagerAddress);
        stabilityPoolFactory = IStabilityPoolFactory(_stabilityPoolFactoryAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        kusdToken = IKUSDToken(_kusdTokenAddress);
        kumoStakingAddress = _kumoStakingAddress;
        kumoStaking = IKUMOStaking(_kumoStakingAddress);

        setKumoParameters(_kumoParamsAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolFactoryAddressChanged(_stabilityPoolFactoryAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit KUSDTokenAddressChanged(_kusdTokenAddress);
        emit KUMOStakingAddressChanged(_kumoStakingAddress);

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openTrove(
        address _asset,
        uint256 _tokenAmount,
        uint256 _maxFeePercentage,
        uint256 _KUSDAmount,
        address _upperHint,
        address _lowerHint
    ) external payable override assetIsInitialized(_asset) {
        checkKUSDMintCap(_asset, _KUSDAmount);
        kumoParams.sanitizeParameters(_asset);
        ContractsCache memory contractsCache = ContractsCache(
            troveManager,
            kumoParams.activePool(),
            kusdToken
        );
        LocalVariables_openTrove memory vars;
        vars.asset = _asset;

        vars.price = kumoParams.priceFeed().fetchPrice(_asset);
        bool isRecoveryMode = _checkRecoveryMode(vars.asset, vars.price);

        _requireValidMaxFeePercentage(vars.asset, _maxFeePercentage, isRecoveryMode);
        _requireTroveisNotActive(vars.asset, contractsCache.troveManager, msg.sender);

        vars.KUSDFee;
        vars.netDebt = _KUSDAmount;

        if (!isRecoveryMode) {
            vars.KUSDFee = _triggerBorrowingFee(
                vars.asset,
                contractsCache.troveManager,
                contractsCache.kusdToken,
                _KUSDAmount,
                _maxFeePercentage
            );
            vars.netDebt = vars.netDebt.add(vars.KUSDFee);
        }
        _requireAtLeastMinNetDebt(vars.asset, vars.netDebt);

        // ICR is based on the composite debt, i.e. the requested KUSD amount + KUSD borrowing fee + KUSD gas comp.
        vars.compositeDebt = _getCompositeDebt(vars.asset, vars.netDebt);
        assert(vars.compositeDebt > 0);

        vars.ICR = KumoMath._computeCR(_tokenAmount, vars.compositeDebt, vars.price);
        vars.NICR = KumoMath._computeNominalCR(_tokenAmount, vars.compositeDebt);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.asset, vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.asset, vars.ICR);
            uint256 newTCR = _getNewTCRFromTroveChange(
                vars.asset,
                _tokenAmount,
                true,
                vars.compositeDebt,
                true,
                vars.price
            ); // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(vars.asset, newTCR);
        }

        // Set the trove struct's properties
        contractsCache.troveManager.setTroveStatus(vars.asset, msg.sender, 1);
        contractsCache.troveManager.increaseTroveColl(vars.asset, msg.sender, _tokenAmount);
        contractsCache.troveManager.increaseTroveDebt(vars.asset, msg.sender, vars.compositeDebt);

        contractsCache.troveManager.updateTroveRewardSnapshots(vars.asset, msg.sender);
        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(vars.asset, msg.sender);

        sortedTroves.insert(vars.asset, msg.sender, vars.NICR, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.troveManager.addTroveOwnerToArray(vars.asset, msg.sender);
        emit TroveCreated(vars.asset, msg.sender, vars.arrayIndex);

        // Move the ether to the Active Pool, and mint the KUSDAmount to the borrower
        _activePoolAddColl(vars.asset, contractsCache.activePool, _tokenAmount);
        _withdrawKUSD(
            vars.asset,
            contractsCache.activePool,
            contractsCache.kusdToken,
            msg.sender,
            _KUSDAmount,
            vars.netDebt
        );
        // Move the KUSD gas compensation to the Gas Pool
        _withdrawKUSD(
            vars.asset,
            contractsCache.activePool,
            contractsCache.kusdToken,
            gasPoolAddress,
            kumoParams.KUSD_GAS_COMPENSATION(vars.asset),
            kumoParams.KUSD_GAS_COMPENSATION(vars.asset)
        );

        emit TroveUpdated(
            vars.asset,
            msg.sender,
            vars.compositeDebt,
            _tokenAmount,
            vars.stake,
            BorrowerOperation.openTrove
        );
        emit KUSDBorrowingFeePaid(vars.asset, msg.sender, vars.KUSDFee);
    }

    // Send Asset as collateral to a trove
    function addColl(
        address _asset,
        uint256 _assetSent,
        address _upperHint,
        address _lowerHint
    ) external payable override {
        _adjustTrove(_asset, _assetSent, msg.sender, 0, 0, false, _upperHint, _lowerHint, 0);
    }

    // Send Asset as collateral to a trove. Called by only the Stability Pool.
    function moveAssetGainToTrove(
        address _asset,
        uint256 _amountMoved,
        address _borrower,
        address _upperHint,
        address _lowerHint
    ) external payable override {
        _requireCallerIsStabilityPool();
        _adjustTrove(_asset, _amountMoved, _borrower, 0, 0, false, _upperHint, _lowerHint, 0);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(
        address _asset,
        uint256 _collWithdrawal,
        address _upperHint,
        address _lowerHint
    ) external override {
        _adjustTrove(_asset, 0, msg.sender, _collWithdrawal, 0, false, _upperHint, _lowerHint, 0);
    }

    // Withdraw KUSD tokens from a trove: mint new KUSD tokens to the owner, and increase the trove's debt accordingly
    function withdrawKUSD(
        address _asset,
        uint256 _maxFeePercentage,
        uint256 _KUSDAmount,
        address _upperHint,
        address _lowerHint
    ) external override {
        checkKUSDMintCap(_asset, _KUSDAmount);
        _adjustTrove(
            _asset,
            0,
            msg.sender,
            0,
            _KUSDAmount,
            true,
            _upperHint,
            _lowerHint,
            _maxFeePercentage
        );
    }

    // Repay KUSD tokens to a Trove: Burn the repaid KUSD tokens, and reduce the trove's debt accordingly
    function repayKUSD(
        address _asset,
        uint256 _KUSDAmount,
        address _upperHint,
        address _lowerHint
    ) external override {
        _adjustTrove(_asset, 0, msg.sender, 0, _KUSDAmount, false, _upperHint, _lowerHint, 0);
    }

    function adjustTrove(
        address _asset,
        uint256 _assetSent,
        uint256 _maxFeePercentage,
        uint256 _collWithdrawal,
        uint256 _KUSDChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable override {
        if (_isDebtIncrease) {
            checkKUSDMintCap(_asset, _KUSDChange);
        }

        _adjustTrove(
            _asset,
            _assetSent,
            msg.sender,
            _collWithdrawal,
            _KUSDChange,
            _isDebtIncrease,
            _upperHint,
            _lowerHint,
            _maxFeePercentage
        );
    }

    /*
     * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal.
     *
     * It therefore expects either a positive msg.value, or a positive _collWithdrawal argument.
     *
     * If both are positive, it will revert.
     */
    function _adjustTrove(
        address _asset,
        uint256 _assetSent,
        address _borrower,
        uint256 _collWithdrawal,
        uint256 _KUSDChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFeePercentage
    ) internal {
        ContractsCache memory contractsCache = ContractsCache(
            troveManager,
            kumoParams.activePool(),
            kusdToken
        );
        LocalVariables_adjustTrove memory vars;
        vars.asset = _asset;

        vars.price = kumoParams.priceFeed().fetchPrice(_asset);
        bool isRecoveryMode = _checkRecoveryMode(vars.asset, vars.price);

        if (_isDebtIncrease) {
            _requireValidMaxFeePercentage(vars.asset, _maxFeePercentage, isRecoveryMode);
            _requireNonZeroDebtChange(_KUSDChange);
        }

        _requireSingularCollChange(_collWithdrawal, _assetSent);
        _requireNonZeroAdjustment(_collWithdrawal, _KUSDChange, _assetSent);
        _requireTroveisActive(vars.asset, contractsCache.troveManager, _borrower);

        // Confirm the operation is either a borrower adjusting their own trove, or a pure Asset transfer from the Stability Pool to a trove
        assert(
            msg.sender == _borrower ||
                (stabilityPoolFactory.isRegisteredStabilityPool(msg.sender) &&
                    _assetSent > 0 &&
                    _KUSDChange == 0)
        );

        contractsCache.troveManager.applyPendingRewards(vars.asset, _borrower);

        // Get the collChange based on whether or not ETH was sent in the transaction
        (vars.collChange, vars.isCollIncrease) = _getCollChange(_assetSent, _collWithdrawal);

        vars.netDebtChange = _KUSDChange;

        // If the adjustment incorporates a debt increase and system is in Normal Mode, then trigger a borrowing fee
        if (_isDebtIncrease && !isRecoveryMode) {
            vars.KUSDFee = _triggerBorrowingFee(
                vars.asset,
                contractsCache.troveManager,
                contractsCache.kusdToken,
                _KUSDChange,
                _maxFeePercentage
            );
            vars.netDebtChange = vars.netDebtChange.add(vars.KUSDFee); // The raw debt change includes the fee
        }

        vars.debt = contractsCache.troveManager.getTroveDebt(vars.asset, _borrower);
        vars.coll = contractsCache.troveManager.getTroveColl(vars.asset, _borrower);

        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = KumoMath._computeCR(vars.coll, vars.debt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(
            vars.coll,
            vars.debt,
            vars.collChange,
            vars.isCollIncrease,
            vars.netDebtChange,
            _isDebtIncrease,
            vars.price
        );
        assert(_collWithdrawal <= vars.coll);

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(
            vars.asset,
            isRecoveryMode,
            _collWithdrawal,
            _isDebtIncrease,
            vars
        );

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough KUSD
        if (!_isDebtIncrease && _KUSDChange > 0) {
            _requireAtLeastMinNetDebt(
                vars.asset,
                _getNetDebt(vars.asset, vars.debt).sub(vars.netDebtChange)
            );
            _requireValidKUSDRepayment(vars.asset, vars.debt, vars.netDebtChange);
            _requireSufficientKUSDBalance(contractsCache.kusdToken, _borrower, vars.netDebtChange);
        }

        (vars.newColl, vars.newDebt) = _updateTroveFromAdjustment(
            vars.asset,
            contractsCache.troveManager,
            _borrower,
            vars.collChange,
            vars.isCollIncrease,
            vars.netDebtChange,
            _isDebtIncrease
        );
        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(vars.asset, _borrower);

        // Re-insert trove in to the sorted list
        uint256 newNICR = _getNewNominalICRFromTroveChange(
            vars.coll,
            vars.debt,
            vars.collChange,
            vars.isCollIncrease,
            vars.netDebtChange,
            _isDebtIncrease
        );
        sortedTroves.reInsert(vars.asset, _borrower, newNICR, _upperHint, _lowerHint);

        emit TroveUpdated(
            vars.asset,
            _borrower,
            vars.newDebt,
            vars.newColl,
            vars.stake,
            BorrowerOperation.adjustTrove
        );
        emit KUSDBorrowingFeePaid(vars.asset, msg.sender, vars.KUSDFee);

        // Use the unmodified _KUSDChange here, as we don't send the fee to the user
        _moveTokensAndETHfromAdjustment(
            vars.asset,
            contractsCache.activePool,
            contractsCache.kusdToken,
            msg.sender,
            vars.collChange,
            vars.isCollIncrease,
            _KUSDChange,
            _isDebtIncrease,
            vars.netDebtChange
        );
    }

    function closeTrove(address _asset) external override {
        ITroveManagerDiamond troveManagerCached = troveManager;
        IActivePool activePoolCached = kumoParams.activePool();
        IKUSDToken kusdTokenCached = kusdToken;

        _requireTroveisActive(_asset, troveManagerCached, msg.sender);
        uint256 price = kumoParams.priceFeed().fetchPrice(_asset);
        _requireNotInRecoveryMode(_asset, price);

        troveManagerCached.applyPendingRewards(_asset, msg.sender);

        uint256 coll = troveManagerCached.getTroveColl(_asset, msg.sender);
        uint256 debt = troveManagerCached.getTroveDebt(_asset, msg.sender);

        _requireSufficientKUSDBalance(
            kusdTokenCached,
            msg.sender,
            debt.sub(kumoParams.KUSD_GAS_COMPENSATION(_asset))
        );

        uint256 newTCR = _getNewTCRFromTroveChange(_asset, coll, false, debt, false, price);
        _requireNewTCRisAboveCCR(_asset, newTCR);

        troveManagerCached.removeStake(_asset, msg.sender);
        troveManagerCached.closeTrove(_asset, msg.sender);

        emit TroveUpdated(_asset, msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);

        // Burn the repaid KUSD from the user's balance and the gas compensation from the Gas Pool
        _repayKUSD(
            _asset,
            activePoolCached,
            kusdTokenCached,
            msg.sender,
            debt.sub(kumoParams.KUSD_GAS_COMPENSATION(_asset))
        );
        _repayKUSD(
            _asset,
            activePoolCached,
            kusdTokenCached,
            gasPoolAddress,
            kumoParams.KUSD_GAS_COMPENSATION(_asset)
        );

        // Send the collateral back to the user
        activePoolCached.sendAsset(_asset, msg.sender, coll);
    }

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral(address _asset) external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(_asset, msg.sender);
    }

    // --- Helper functions ---

    function _triggerBorrowingFee(
        address _asset,
        ITroveManagerDiamond _troveManager,
        IKUSDToken _kusdToken,
        uint256 _KUSDAmount,
        uint256 _maxFeePercentage
    ) internal returns (uint256) {
        _troveManager.decayBaseRateFromBorrowing(); // decay the baseRate state variable
        uint256 KUSDFee = _troveManager.getBorrowingFee(_asset, _KUSDAmount);

        _requireUserAcceptsFee(KUSDFee, _KUSDAmount, _maxFeePercentage);

        // Send fee to Stability Pool providers
        stabilityPoolFactory.getStabilityPoolByAsset(_asset).increaseF_KUSD(KUSDFee);

        _kusdToken.mint(
            _asset,
            address(stabilityPoolFactory.getStabilityPoolByAsset(_asset)),
            KUSDFee
        );

        return KUSDFee;
    }

    function _getUSDValue(uint256 _coll, uint256 _price) internal pure returns (uint256) {
        uint256 usdValue = _price.mul(_coll).div(DECIMAL_PRECISION);

        return usdValue;
    }

    function _getCollChange(
        uint256 _collReceived,
        uint256 _requestedCollWithdrawal
    ) internal pure returns (uint256 collChange, bool isCollIncrease) {
        if (_collReceived != 0) {
            collChange = _collReceived;
            isCollIncrease = true;
        } else {
            collChange = _requestedCollWithdrawal;
        }
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment(
        address _asset,
        ITroveManagerDiamond _troveManager,
        address _borrower,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) internal returns (uint256, uint256) {
        uint256 newColl = (_isCollIncrease)
            ? _troveManager.increaseTroveColl(_asset, _borrower, _collChange)
            : _troveManager.decreaseTroveColl(_asset, _borrower, _collChange);
        uint256 newDebt = (_isDebtIncrease)
            ? _troveManager.increaseTroveDebt(_asset, _borrower, _debtChange)
            : _troveManager.decreaseTroveDebt(_asset, _borrower, _debtChange);

        return (newColl, newDebt);
    }

    function _moveTokensAndETHfromAdjustment(
        address _asset,
        IActivePool _activePool,
        IKUSDToken _kusdToken,
        address _borrower,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _KUSDChange,
        bool _isDebtIncrease,
        uint256 _netDebtChange
    ) internal {
        if (_isDebtIncrease) {
            _withdrawKUSD(_asset, _activePool, _kusdToken, _borrower, _KUSDChange, _netDebtChange);
        } else {
            _repayKUSD(_asset, _activePool, _kusdToken, _borrower, _KUSDChange);
        }

        if (_isCollIncrease) {
            _activePoolAddColl(_asset, _activePool, _collChange);
        } else {
            _activePool.sendAsset(_asset, _borrower, _collChange);
        }
    }

    // Send ETH to Active Pool and increase its recorded ETH balance
    function _activePoolAddColl(address _asset, IActivePool _activePool, uint256 _amount) internal {
        // (bool success, ) = address(_activePool).call{value: _amount}("");
        // require(success, "BorrowerOps: Sending ETH to ActivePool failed");
        IERC20Upgradeable(_asset).safeTransferFrom(
            msg.sender,
            address(_activePool),
            SafetyTransfer.decimalsCorrection(_asset, _amount)
        );
        _activePool.receivedERC20(_asset, _amount);
    }

    // Issue the specified amount of KUSD to _account and increases the total active debt (_netDebtIncrease potentially includes a KUSDFee)
    function _withdrawKUSD(
        address _asset,
        IActivePool _activePool,
        IKUSDToken _kusdToken,
        address _account,
        uint256 _KUSDAmount,
        uint256 _netDebtIncrease
    ) internal {
        _activePool.increaseKUSDDebt(_asset, _netDebtIncrease);
        _kusdToken.mint(_asset, _account, _KUSDAmount);
    }

    // Burn the specified amount of KUSD from _account and decreases the total active debt
    function _repayKUSD(
        address _asset,
        IActivePool _activePool,
        IKUSDToken _kusdToken,
        address _account,
        uint256 _KUSD
    ) internal {
        _activePool.decreaseKUSDDebt(_asset, _KUSD);
        _kusdToken.burn(_account, _KUSD);
    }

    function KUSDMintRemainder(address _asset) external view returns (uint256) {
        int256 remainder = int256(kumoParams.KUSDMintCap(_asset) - kusdToken.totalSupply());

        if (remainder < 0) {
            return 0;
        } else {
            return uint256(remainder);
        }
    }

    // --- 'Require' wrapper functions ---

    function _requireSingularCollChange(uint256 _collWithdrawal, uint256 _amountSent) internal pure {
        require(
            _collWithdrawal == 0 || _amountSent == 0,
            "BorrowerOperations: Cannot withdraw and add coll"
        );
    }

    function _requireCallerIsBorrower(address _borrower) internal view {
        require(
            msg.sender == _borrower,
            "BorrowerOps: Caller must be the borrower for a withdrawal"
        );
    }

    function _requireNonZeroAdjustment(
        uint256 _collWithdrawal,
        uint256 _KUSDChange,
        uint256 _amountSent
    ) internal pure {
        require(
            _collWithdrawal != 0 || _KUSDChange != 0 || _amountSent != 0,
            "BorrowerOps: There must be either a collateral change or a debt change"
        );
    }

    function _requireTroveisActive(
        address _asset,
        ITroveManagerDiamond _troveManager,
        address _borrower
    ) internal view {
        uint256 status = _troveManager.getTroveStatus(_asset, _borrower);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(
        address _asset,
        ITroveManagerDiamond _troveManager,
        address _borrower
    ) internal view {
        uint256 status = _troveManager.getTroveStatus(_asset, _borrower);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroDebtChange(uint256 _KUSDChange) internal pure {
        require(_KUSDChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }

    function _requireNotInRecoveryMode(address _asset, uint256 _price) internal view {
        require(
            !_checkRecoveryMode(_asset, _price),
            "BorrowerOps: Operation not permitted during Recovery Mode"
        );
    }

    function _requireNoCollWithdrawal(uint256 _collWithdrawal) internal pure {
        require(
            _collWithdrawal == 0,
            "BorrowerOps: Collateral withdrawal not permitted Recovery Mode"
        );
    }

    function _requireValidAdjustmentInCurrentMode(
        address _asset,
        bool _isRecoveryMode,
        uint256 _collWithdrawal,
        bool _isDebtIncrease,
        LocalVariables_adjustTrove memory _vars
    ) internal view {
        /*
         *In Recovery Mode, only allow:
         *
         * - Pure collateral top-up
         * - Pure debt repayment
         * - Collateral top-up with debt repayment
         * - A debt increase combined with a collateral top-up which makes the ICR >= 150% and improves the ICR (and by extension improves the TCR).
         *
         * In Normal Mode, ensure:
         *
         * - The new ICR is above MCR
         * - The adjustment won't pull the TCR below CCR
         */
        if (_isRecoveryMode) {
            _requireNoCollWithdrawal(_collWithdrawal);
            if (_isDebtIncrease) {
                _requireICRisAboveCCR(_asset, _vars.newICR);
                _requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
            }
        } else {
            // if Normal Mode
            _requireICRisAboveMCR(_asset, _vars.newICR);
            _vars.newTCR = _getNewTCRFromTroveChange(
                _asset,
                _vars.collChange,
                _vars.isCollIncrease,
                _vars.netDebtChange,
                _isDebtIncrease,
                _vars.price
            );
            _requireNewTCRisAboveCCR(_asset, _vars.newTCR);
        }
    }

    function _requireICRisAboveMCR(address _asset, uint256 _newICR) internal view {
        require(
            _newICR >= kumoParams.MCR(_asset),
            "BorrowerOps: An operation that would result in ICR < MCR is not permitted"
        );
    }

    function _requireICRisAboveCCR(address _asset, uint256 _newICR) internal view {
        require(
            _newICR >= kumoParams.CCR(_asset),
            "BorrowerOps: Operation must leave trove with ICR >= CCR"
        );
    }

    function _requireNewICRisAboveOldICR(uint256 _newICR, uint256 _oldICR) internal pure {
        require(
            _newICR >= _oldICR,
            "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode"
        );
    }

    function _requireNewTCRisAboveCCR(address _asset, uint256 _newTCR) internal view {
        require(
            _newTCR >= kumoParams.CCR(_asset),
            "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
        );
    }

    function _requireAtLeastMinNetDebt(address _asset, uint256 _netDebt) internal view {
        require(
            _netDebt >= kumoParams.MIN_NET_DEBT(_asset),
            "BorrowerOps: Trove's net debt must be greater than minimum"
        );
    }

    function _requireValidKUSDRepayment(
        address _asset,
        uint256 _currentDebt,
        uint256 _debtRepayment
    ) internal view {
        require(
            _debtRepayment <= _currentDebt.sub(kumoParams.KUSD_GAS_COMPENSATION(_asset)),
            "BorrowerOps: Amount repaid must not be larger than the Trove's debt"
        );
    }

    function _requireCallerIsStabilityPool() internal view {
        require(
            stabilityPoolFactory.isRegisteredStabilityPool(msg.sender),
            "BorrowerOps: Caller is not Stability Pool"
        );
    }

    function _requireSufficientKUSDBalance(
        IKUSDToken _kusdToken,
        address _borrower,
        uint256 _debtRepayment
    ) internal view {
        require(
            _kusdToken.balanceOf(_borrower) >= _debtRepayment,
            "BorrowerOps: Caller doesnt have enough KUSD to make repayment"
        );
    }

    function _requireValidMaxFeePercentage(
        address _asset,
        uint256 _maxFeePercentage,
        bool _isRecoveryMode
    ) internal view {
        // In recovery mode we are not charging borrowing fee, so we can ignore this param
        if (_isRecoveryMode) {
            require(
                _maxFeePercentage <= kumoParams.DECIMAL_PRECISION(),
                "Max fee percentage must less than or equal to 100%"
            );
        } else {
            require(
                _maxFeePercentage >= kumoParams.BORROWING_FEE_FLOOR(_asset) &&
                    _maxFeePercentage <= kumoParams.DECIMAL_PRECISION(),
                "Max fee percentage must be between 0.5% and 100%"
            );
        }
    }

    // --- ICR and TCR getters ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewNominalICRFromTroveChange(
        uint256 _coll,
        uint256 _debt,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) internal pure returns (uint256) {
        (uint256 newColl, uint256 newDebt) = _getNewTroveAmounts(
            _coll,
            _debt,
            _collChange,
            _isCollIncrease,
            _debtChange,
            _isDebtIncrease
        );

        uint256 newNICR = KumoMath._computeNominalCR(newColl, newDebt);
        return newNICR;
    }

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange(
        uint256 _coll,
        uint256 _debt,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease,
        uint256 _price
    ) internal pure returns (uint256) {
        (uint256 newColl, uint256 newDebt) = _getNewTroveAmounts(
            _coll,
            _debt,
            _collChange,
            _isCollIncrease,
            _debtChange,
            _isDebtIncrease
        );

        uint256 newICR = KumoMath._computeCR(newColl, newDebt, _price);
        return newICR;
    }

    function _getNewTroveAmounts(
        uint256 _coll,
        uint256 _debt,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) internal pure returns (uint256, uint256) {
        uint256 newColl = _coll;
        uint256 newDebt = _debt;

        newColl = _isCollIncrease ? _coll.add(_collChange) : _coll.sub(_collChange);
        newDebt = _isDebtIncrease ? _debt.add(_debtChange) : _debt.sub(_debtChange);

        return (newColl, newDebt);
    }

    function _getNewTCRFromTroveChange(
        address _asset,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease,
        uint256 _price
    ) internal view returns (uint256) {
        uint256 totalColl = getEntireSystemColl(_asset);
        uint256 totalDebt = getEntireSystemDebt(_asset);

        totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
        totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt.sub(_debtChange);

        uint256 newTCR = KumoMath._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(
        address _asset,
        uint256 _debt
    ) external view override returns (uint256) {
        return _getCompositeDebt(_asset, _debt);
    }

    function checkKUSDMintCap(address _asset, uint256 _KUSDAmount) internal {
        require(
            kusdToken.totalSupply() + _KUSDAmount <= kumoParams.KUSDMintCap(_asset),
            "KUSD mint cap is reached for this asset"
        );
    }
}
