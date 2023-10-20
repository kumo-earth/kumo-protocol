// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Dependencies/CheckContract.sol";
import "./Dependencies/Ownable.sol";
import "./Interfaces/IKumoParameters.sol";

contract KumoParameters is IKumoParameters, Ownable, CheckContract {
    string public constant NAME = "KumoParameters";

    // During bootsrap period redemptions are not allowed
    uint256 public constant BOOTSTRAP_PERIOD = 14 days;

    uint256 public constant override DECIMAL_PRECISION = 1 ether;
    uint256 public constant override _100pct = 1 ether; // 1e18 == 100%

    uint256 public constant KUSD_GAS_COMPENSATION_DEFAULT = 200e18;
    // uint256 public constant KUSD_GAS_COMPENSATION = 200e18;
    // Minimum collateral ratio for individual troves
    uint256 public constant MCR_DEFAULT = 1100000000000000000; // 110%
    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, Recovery Mode is triggered.
    uint256 public constant CCR_DEFAULT = 1500000000000000000; // 150%
    // Minimum amount of net KUSD debt a trove must have
    uint256 public constant MIN_NET_DEBT_DEFAULT = 1800e18;
    // uint256 constant public MIN_NET_DEBT = 0;
    uint256 public constant PERCENT_DIVISOR_DEFAULT = 200; // dividing by 200 yields 0.5%
    uint256 public constant REDEMPTION_BLOCK_DAY = 14;

    uint256 public constant BORROWING_FEE_FLOOR_DEFAULT = (DECIMAL_PRECISION / 1000) * 5; // 0.5%
    uint256 public constant MAX_BORROWING_FEE_DEFAULT = (DECIMAL_PRECISION / 100) * 5; // 5%

    uint256 public constant REDEMPTION_FEE_FLOOR_DEFAULT = (DECIMAL_PRECISION / 1000) * 5; // 0.5%
    uint256 public constant KUSD_MINT_CAP_DEFAULT = 10000000 * 10e18; // 10M

    // KUSD mint caps per asset
    mapping(address => uint256) public KUSDMintCap;

    // Minimum collateral ratio for individual troves
    mapping(address => uint256) public override MCR;
    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, Recovery Mode is triggered.
    mapping(address => uint256) public override CCR;

    mapping(address => uint256) public override KUSD_GAS_COMPENSATION; // Amount of KUSD to be locked in gas pool on opening troves
    mapping(address => uint256) public override MIN_NET_DEBT; // Minimum amount of net KUSD debt a trove must have
    mapping(address => uint256) public override PERCENT_DIVISOR; // dividing by 200 yields 0.5%
    mapping(address => uint256) public override BORROWING_FEE_FLOOR;
    mapping(address => uint256) public override REDEMPTION_FEE_FLOOR;
    mapping(address => uint256) public override MAX_BORROWING_FEE;
    mapping(address => uint256) public override redemptionBlock;

    mapping(address => bool) public override hasCollateralConfigured;

    IActivePool public override activePool;
    IDefaultPool public override defaultPool;
    IPriceFeed public override priceFeed;
    IBorrowerOperations public override borrowerOperations;
    ICollSurplusPool public override collSurplusPool;
    IKUSDToken public override kusdToken;
    IStabilityPoolFactory public override stabilityPoolFactory;
    address public gasPoolAddress;
    ISortedTroves public override sortedTroves;
    IKUMOToken public override kumoToken;
    IKUMOStaking public override kumoStaking;
    // address public adminContract;

    bool public isInitialized;

    // modifier isController() {
    // 	require(msg.sender == owner() || msg.sender == adminContract, "Invalid Permissions");
    // 	_;
    // }

    function setAddresses(
        address _activePool,
        address _defaultPool,
        address _gasPoolAddress,
        address _priceFeed,
        address _borrowerOperationsAddress,
        address _collSurplusPoolAddress,
        address _kusdTokenAddress,
        address _stabilityPoolFactoryAddress,
        address _sortedTrovesAddress,
        address _kumoTokenAddress,
        address _kumoStakingAddress
    ) external onlyOwner {
        require(!isInitialized, "Already initalized");
        checkContract(_activePool);
        checkContract(_defaultPool);
        checkContract(_priceFeed);
        checkContract(_borrowerOperationsAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_kusdTokenAddress);
        checkContract(_stabilityPoolFactoryAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_kumoTokenAddress);
        checkContract(_kumoStakingAddress);
        isInitialized = true;

        activePool = IActivePool(_activePool);
        defaultPool = IDefaultPool(_defaultPool);
        priceFeed = IPriceFeed(_priceFeed);
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        kusdToken = IKUSDToken(_kusdTokenAddress);
        stabilityPoolFactory = IStabilityPoolFactory(_stabilityPoolFactoryAddress);
        gasPoolAddress = _gasPoolAddress;
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        kumoToken = IKUMOToken(_kumoTokenAddress);
        kumoStaking = IKUMOStaking(_kumoStakingAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit StabilityPoolFactoryAddressChanged(_stabilityPoolFactoryAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit KUSDTokenAddressChanged(_kusdTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit KUMOTokenAddressChanged(_kumoTokenAddress);
        emit KUMOStakingAddressChanged(_kumoStakingAddress);
    }

    function setPriceFeed(address _priceFeed) external override onlyOwner {
        checkContract(_priceFeed);
        priceFeed = IPriceFeed(_priceFeed);

        emit PriceFeedChanged(_priceFeed);
    }

    function sanitizeParameters(address _asset) external {
        if (!hasCollateralConfigured[_asset]) {
            _setAsDefault(_asset);
        }
    }

    function setAsDefault(address _asset) external {
        _setAsDefault(_asset);
    }

    // function setAsDefaultWithRemptionBlock(address _asset, uint256 blockInDays)
    // 	external
    // 	isController
    // {
    // 	if (blockInDays > 14) {
    // 		blockInDays = REDEMPTION_BLOCK_DAY;
    // 	}

    // 	if (redemptionBlock[_asset] == 0) {
    // 		redemptionBlock[_asset] = block.timestamp + (blockInDays * 1 days);
    // 	}

    // 	_setAsDefault(_asset);
    // }

    function _setAsDefault(address _asset) private {
        hasCollateralConfigured[_asset] = true;

        MCR[_asset] = MCR_DEFAULT;
        CCR[_asset] = CCR_DEFAULT;
        KUSD_GAS_COMPENSATION[_asset] = KUSD_GAS_COMPENSATION_DEFAULT;
        MIN_NET_DEBT[_asset] = MIN_NET_DEBT_DEFAULT;
        PERCENT_DIVISOR[_asset] = PERCENT_DIVISOR_DEFAULT;
        BORROWING_FEE_FLOOR[_asset] = BORROWING_FEE_FLOOR_DEFAULT;
        MAX_BORROWING_FEE[_asset] = MAX_BORROWING_FEE_DEFAULT;
        REDEMPTION_FEE_FLOOR[_asset] = REDEMPTION_FEE_FLOOR_DEFAULT;
        KUSDMintCap[_asset] = KUSD_MINT_CAP_DEFAULT;
    }

    function setCollateralParameters(
        address _asset,
        uint256 newMCR,
        uint256 newCCR,
        uint256 gasCompensation,
        uint256 minNetDebt,
        uint256 precentDivisor,
        uint256 borrowingFeeFloor,
        uint256 maxBorrowingFee,
        uint256 redemptionFeeFloor
    ) public onlyOwner {
        hasCollateralConfigured[_asset] = true;

        setMCR(_asset, newMCR);
        setCCR(_asset, newCCR);
        setKUMOGasCompensation(_asset, gasCompensation);
        setMinNetDebt(_asset, minNetDebt);
        setPercentDivisor(_asset, precentDivisor);
        setMaxBorrowingFee(_asset, maxBorrowingFee);
        setBorrowingFeeFloor(_asset, borrowingFeeFloor);
        setRedemptionFeeFloor(_asset, redemptionFeeFloor);
    }

    function setMCR(
        address _asset,
        uint256 newMCR
    )
        public
        override
        onlyOwner
        safeCheck("MCR", _asset, newMCR, 1010000000000000000, 10000000000000000000) /// 101% - 1000%
    {
        uint256 oldMCR = MCR[_asset];
        MCR[_asset] = newMCR;

        emit MCRChanged(oldMCR, newMCR);
    }

    function setCCR(
        address _asset,
        uint256 newCCR
    )
        public
        override
        onlyOwner
        safeCheck("CCR", _asset, newCCR, 1010000000000000000, 10000000000000000000) /// 101% - 1000%
    {
        uint256 oldCCR = CCR[_asset];
        CCR[_asset] = newCCR;

        emit CCRChanged(oldCCR, newCCR);
    }

    function setPercentDivisor(
        address _asset,
        uint256 precentDivisor
    ) public override onlyOwner safeCheck("Percent Divisor", _asset, precentDivisor, 2, 200) {
        uint256 oldPercent = PERCENT_DIVISOR[_asset];
        PERCENT_DIVISOR[_asset] = precentDivisor;

        emit PercentDivisorChanged(oldPercent, precentDivisor);
    }

    function setBorrowingFeeFloor(
        address _asset,
        uint256 borrowingFeeFloor
    )
        public
        override
        onlyOwner
        safeCheck("Borrowing Fee Floor", _asset, borrowingFeeFloor, 0, 1000) /// 0% - 10%
    {
        uint256 oldBorrowing = BORROWING_FEE_FLOOR[_asset];
        uint256 newBorrowingFee = (DECIMAL_PRECISION / 10000) * borrowingFeeFloor;

        BORROWING_FEE_FLOOR[_asset] = newBorrowingFee;

        emit BorrowingFeeFloorChanged(oldBorrowing, newBorrowingFee);
    }

    function setMaxBorrowingFee(
        address _asset,
        uint256 maxBorrowingFee
    )
        public
        override
        onlyOwner
        safeCheck("Max Borrowing Fee", _asset, maxBorrowingFee, 0, 1000) /// 0% - 10%
    {
        uint256 oldMaxBorrowingFee = MAX_BORROWING_FEE[_asset];
        uint256 newMaxBorrowingFee = (DECIMAL_PRECISION / 10000) * maxBorrowingFee;

        MAX_BORROWING_FEE[_asset] = newMaxBorrowingFee;
        emit MaxBorrowingFeeChanged(oldMaxBorrowingFee, newMaxBorrowingFee);
    }

    function setKUMOGasCompensation(
        address _asset,
        uint256 gasCompensation
    )
        public
        override
        onlyOwner
        safeCheck("Gas Compensation", _asset, gasCompensation, 1 ether, 400 ether)
    {
        uint256 oldGasComp = KUSD_GAS_COMPENSATION[_asset];
        KUSD_GAS_COMPENSATION[_asset] = gasCompensation;

        emit GasCompensationChanged(oldGasComp, gasCompensation);
    }

    function setMinNetDebt(
        address _asset,
        uint256 minNetDebt
    ) public override onlyOwner safeCheck("Min Net Debt", _asset, minNetDebt, 0, 1800 ether) {
        uint256 oldMinNet = MIN_NET_DEBT[_asset];
        MIN_NET_DEBT[_asset] = minNetDebt;

        emit MinNetDebtChanged(oldMinNet, minNetDebt);
    }

    function setRedemptionFeeFloor(
        address _asset,
        uint256 redemptionFeeFloor
    )
        public
        override
        onlyOwner
        safeCheck("Redemption Fee Floor", _asset, redemptionFeeFloor, 10, 1000) /// 0.10% - 10%
    {
        uint256 oldRedemptionFeeFloor = REDEMPTION_FEE_FLOOR[_asset];
        uint256 newRedemptionFeeFloor = (DECIMAL_PRECISION / 10000) * redemptionFeeFloor;

        REDEMPTION_FEE_FLOOR[_asset] = newRedemptionFeeFloor;
        emit RedemptionFeeFloorChanged(oldRedemptionFeeFloor, newRedemptionFeeFloor);
    }

    function removeRedemptionBlock(address _asset) external override onlyOwner {
        redemptionBlock[_asset] = block.timestamp;

        emit RedemptionBlockRemoved(_asset);
    }

    // function assetIsInitialzed(address _asset) external {
    // 	return hasCollateralConfigured[_asset];
    // }

    function setKUSDMintCap(address _asset, uint256 _newCap) public onlyOwner {
        uint256 _oldCap = KUSDMintCap[_asset];
        KUSDMintCap[_asset] = _newCap;

        emit KUSDMintCapChanged(_asset, _oldCap, _newCap);
    }

    modifier safeCheck(
        string memory parameter,
        address _asset,
        uint256 enteredValue,
        uint256 min,
        uint256 max
    ) {
        require(
            hasCollateralConfigured[_asset],
            "Collateral is not configured, use setAsDefault or setCollateralParameters"
        );

        if (enteredValue < min || enteredValue > max) {
            revert SafeCheckError(parameter, enteredValue, min, max);
        }
        _;
    }
}
