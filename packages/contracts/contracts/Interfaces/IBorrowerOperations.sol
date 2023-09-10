// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

// Common interface for the Trove Manager.
interface IBorrowerOperations {
    // --- Events ---

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolFactoryAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event KUSDTokenAddressChanged(address _kusdTokenAddress);
    event KUMOStakingAddressChanged(address _kumoStakingAddress);

    event TroveCreated(address indexed _asset, address indexed _borrower, uint256 arrayIndex);
    event TroveUpdated(
        address indexed _asset,
        address indexed _borrower,
        uint256 _debt,
        uint256 _coll,
        uint256 stake,
        uint8 operation
    );
    event KUSDBorrowingFeePaid(address indexed _asset, address indexed _borrower, uint256 _KUSDFee);

    // --- Functions ---

    function setAddresses(
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _sortedTrovesAddress,
        address _kusdTokenAddress,
        address _kumoStakingAddress,
        address _kumoParamsAddress
    ) external;

    function openTrove(
        address _asset,
        uint256 _tokenAmount,
        uint256 _maxFee,
        uint256 _KUSDAmount,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function addColl(
        address _asset,
        uint256 _assetSent,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function moveAssetGainToTrove(
        address _asset,
        uint256 amountMoved,
        address _user,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function withdrawColl(
        address _asset,
        uint256 _collWithdrawal,
        address _upperHint,
        address _lowerHint
    ) external;

    function withdrawKUSD(
        address _asset,
        uint256 _maxFee,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function repayKUSD(
        address _asset,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function closeTrove(address _asset) external;

    function adjustTrove(
        address _asset,
        uint256 _assetSent,
        uint256 _maxFee,
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function claimCollateral(address _asset) external;

    function getCompositeDebt(address _asset, uint256 _debt) external view returns (uint256);

    function KUSDMintRemainder(address _asset) external view returns (uint256);
}
