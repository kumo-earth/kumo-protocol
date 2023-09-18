// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/ITroveManagerDiamond.sol";

contract TroveManagerScript is CheckContract {
    string public constant NAME = "TroveManagerScript";

    ITroveManagerDiamond immutable troveManager;

    constructor(ITroveManagerDiamond _troveManager) {
        checkContract(address(_troveManager));
        troveManager = _troveManager;
    }

    function redeemCollateral(
        address _asset,
        uint256 _KUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external returns (uint256 collateral) {
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
        return collateral;
    }
}
