// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Interfaces/ITroveManagerDiamond.sol";
import "../BorrowerOperations.sol";
import "../StabilityPoolFactory.sol";
import "../KUSDToken.sol";
import "../Interfaces/IStabilityPool.sol";

contract EchidnaProxy {
    ITroveManagerDiamond troveManager;
    BorrowerOperations borrowerOperations;
    StabilityPoolFactory stabilityPoolFactory;
    KUSDToken kusdToken;

    constructor(
        address _troveManagerAddress,
        BorrowerOperations _borrowerOperations,
        StabilityPoolFactory _stabilityPoolFactory,
        KUSDToken _kusdToken
    ) {
        troveManager = ITroveManagerDiamond(_troveManagerAddress);
        borrowerOperations = _borrowerOperations;
        stabilityPoolFactory = _stabilityPoolFactory;
        kusdToken = _kusdToken;
    }

    receive() external payable {
        // do nothing
    }

    // TroveManager

    function liquidatePrx(address _asset, address _user) external {
        troveManager.liquidate(_asset, _user);
    }

    function liquidateTrovesPrx(address _asset, uint256 _n) external {
        troveManager.liquidateTroves(_asset, _n);
    }

    function batchLiquidateTrovesPrx(address _asset, address[] calldata _troveArray) external {
        troveManager.batchLiquidateTroves(_asset, _troveArray);
    }

    function redeemCollateralPrx(
        address _asset,
        uint256 _KUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external {
        troveManager.redeemCollateral(
            _asset,
            _KUSDAmount,
            _firstRedemptionHint,
            _upperPartialRedemptionHint,
            _lowerPartialRedemptionHint,
            _partialRedemptionHintNICR,
            _maxIterations,
            _maxFee
        );
    }

    // Borrower Operations
    function openTrovePrx(
        address _asset,
        uint256 _tokenAmount,
        uint256 _KUSDAmount,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) external payable {
        borrowerOperations.openTrove{value: _tokenAmount}(
            _asset,
            _tokenAmount,
            _maxFee,
            _KUSDAmount,
            _upperHint,
            _lowerHint
        );
    }

    function addCollPrx(
        address _asset,
        uint256 _assetSent,
        address _upperHint,
        address _lowerHint
    ) external payable {
        borrowerOperations.addColl{value: _assetSent}(_asset, _assetSent, _upperHint, _lowerHint);
    }

    function withdrawCollPrx(
        address _asset,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        borrowerOperations.withdrawColl(_asset, _amount, _upperHint, _lowerHint);
    }

    function withdrawKUSDPrx(
        address _asset,
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) external {
        borrowerOperations.withdrawKUSD(_asset, _maxFee, _amount, _upperHint, _lowerHint);
    }

    function repayKUSDPrx(
        address _asset,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        borrowerOperations.repayKUSD(_asset, _amount, _upperHint, _lowerHint);
    }

    function closeTrovePrx(address _asset) external {
        borrowerOperations.closeTrove(_asset);
    }

    function adjustTrovePrx(
        address _asset,
        uint256 _assetSent,
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) external payable {
        borrowerOperations.adjustTrove{value: _assetSent}(
            _asset,
            _assetSent,
            _maxFee,
            _collWithdrawal,
            _debtChange,
            _isDebtIncrease,
            _upperHint,
            _lowerHint
        );
    }

    // Pool Manager
    function provideToSPPrx(address _asset, uint256 _amount, address _frontEndTag) external {
        IStabilityPool stabilityPoolCached = stabilityPoolFactory.getStabilityPoolByAsset(_asset);
        stabilityPoolCached.provideToSP(_amount);
    }

    function withdrawFromSPPrx(address _asset, uint256 _amount) external {
        IStabilityPool stabilityPoolCached = stabilityPoolFactory.getStabilityPoolByAsset(_asset);
        stabilityPoolCached.withdrawFromSP(_amount);
    }

    // KUSD Token

    function transferPrx(address recipient, uint256 amount) external returns (bool) {
        return kusdToken.transfer(recipient, amount);
    }

    function approvePrx(address spender, uint256 amount) external returns (bool) {
        return kusdToken.approve(spender, amount);
    }

    function transferFromPrx(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        return kusdToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(address spender, uint256 addedValue) external returns (bool) {
        return kusdToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(address spender, uint256 subtractedValue) external returns (bool) {
        return kusdToken.decreaseAllowance(spender, subtractedValue);
    }
}
