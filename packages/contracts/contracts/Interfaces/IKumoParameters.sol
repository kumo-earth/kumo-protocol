// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import "./IActivePool.sol";
import "./IBorrowerOperations.sol";
import "./ICollSurplusPool.sol";
import "./IDefaultPool.sol";
import "./IPriceFeed.sol";
import "./IKumoBase.sol";
import "./IKUSDToken.sol";
import "./IStabilityPoolFactory.sol";
import "./ISortedTroves.sol";
import "./IKUMOToken.sol";
import "./IKUMOStaking.sol";

interface IKumoParameters {
    error SafeCheckError(string parameter, uint256 valueEntered, uint256 minValue, uint256 maxValue);

    event MCRChanged(uint256 oldMCR, uint256 newMCR);
    event CCRChanged(uint256 oldCCR, uint256 newCCR);
    event GasCompensationChanged(uint256 oldGasComp, uint256 newGasComp);
    event MinNetDebtChanged(uint256 oldMinNet, uint256 newMinNet);
    event PercentDivisorChanged(uint256 oldPercentDiv, uint256 newPercentDiv);
    event BorrowingFeeFloorChanged(uint256 oldBorrowingFloorFee, uint256 newBorrowingFloorFee);
    event MaxBorrowingFeeChanged(uint256 oldMaxBorrowingFee, uint256 newMaxBorrowingFee);
    event RedemptionFeeFloorChanged(uint256 oldRedemptionFeeFloor, uint256 newRedemptionFeeFloor);
    event RedemptionBlockRemoved(address _asset);
    event PriceFeedChanged(address indexed addr);

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event KUSDTokenAddressChanged(address _newKUSDTokenAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolFactoryAddressChanged(address _stabilityPoolFactoryAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event KUMOTokenAddressChanged(address _kumoTokenAddress);
    event KUMOStakingAddressChanged(address _kumoStakingAddress);
    event TroveRedemptorAddressChanged(address _troveRedemptorAddress);

    function BOOTSTRAP_PERIOD() external view returns (uint256);

    function DECIMAL_PRECISION() external view returns (uint256);

    function _100pct() external view returns (uint256);

    // Minimum collateral ratio for individual troves
    function MCR(address _collateral) external view returns (uint256);

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, Recovery Mode is triggered.
    function CCR(address _collateral) external view returns (uint256);

    function KUSD_GAS_COMPENSATION(address _collateral) external view returns (uint256);

    function MIN_NET_DEBT(address _collateral) external view returns (uint256);

    function PERCENT_DIVISOR(address _collateral) external view returns (uint256);

    function BORROWING_FEE_FLOOR(address _collateral) external view returns (uint256);

    function REDEMPTION_FEE_FLOOR(address _collateral) external view returns (uint256);

    function MAX_BORROWING_FEE(address _collateral) external view returns (uint256);

    function redemptionBlock(address _collateral) external view returns (uint256);

    function activePool() external view returns (IActivePool);

    function defaultPool() external view returns (IDefaultPool);

    function priceFeed() external view returns (IPriceFeed);

    function borrowerOperations() external view returns (IBorrowerOperations);

    function collSurplusPool() external view returns (ICollSurplusPool);

    function kusdToken() external view returns (IKUSDToken);

    function stabilityPoolFactory() external view returns (IStabilityPoolFactory);

    function gasPoolAddress() external view returns (address);

    function sortedTroves() external view returns (ISortedTroves);

    function kumoToken() external view returns (IKUMOToken);

    function kumoStaking() external view returns (IKUMOStaking);

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
    ) external;

    function setPriceFeed(address _priceFeed) external;

    function setMCR(address _asset, uint256 newMCR) external;

    function setCCR(address _asset, uint256 newCCR) external;

    function sanitizeParameters(address _asset) external;

    function setAsDefault(address _asset) external;

    // function setAsDefaultWithRemptionBlock(address _asset, uint256 blockInDays) external;

    function setKUMOGasCompensation(address _asset, uint256 gasCompensation) external;

    function setMinNetDebt(address _asset, uint256 minNetDebt) external;

    function setPercentDivisor(address _asset, uint256 precentDivisor) external;

    function setBorrowingFeeFloor(address _asset, uint256 borrowingFeeFloor) external;

    function setMaxBorrowingFee(address _asset, uint256 maxBorrowingFee) external;

    function setRedemptionFeeFloor(address _asset, uint256 redemptionFeeFloor) external;

    function removeRedemptionBlock(address _asset) external;

    function hasCollateralConfigured(address _asset) external view returns (bool);
}
