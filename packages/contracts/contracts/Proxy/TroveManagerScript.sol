// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/ITroveManager.sol";


contract TroveManagerScript is CheckContract {
    string constant public NAME = "TroveManagerScript";

    ITroveManager immutable troveManager;

    constructor (ITroveManager _troveManager) {
        checkContract(address(_troveManager));
        troveManager = _troveManager;
    }

    function redeemCollateral(
        uint _KUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external returns (uint collateral) {
         troveManager.redeemCollateral(
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
