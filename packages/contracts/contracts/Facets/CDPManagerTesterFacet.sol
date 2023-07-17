// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Interfaces/IKumoParameters.sol";
import "../Dependencies/KumoMath.sol";

import {Modifiers} from "../Libraries/LibAppStorage.sol";
import {LibKumoBase} from "../Libraries/LibKumoBase.sol";
import {LibTroveManager} from "../Libraries/LibTroveManager.sol";

contract CDPManagerTesterFacet is Modifiers {
    function computeICR(
        uint256 _coll,
        uint256 _debt,
        uint256 _price
    ) external pure returns (uint256) {
        return KumoMath._computeCR(_coll, _debt, _price);
    }

    function getCollGasCompensation(address _asset, uint256 _coll) external view returns (uint256) {
        return LibKumoBase._getCollGasCompensation(_asset, _coll);
    }

    function getkusdGasCompensation(address _asset) external view returns (uint256) {
        return s.kumoParams.KUSD_GAS_COMPENSATION(_asset);
    }

    function getCompositeDebt(address _asset, uint256 _debt) external view returns (uint256) {
        return LibKumoBase._getCompositeDebt(_asset, _debt);
    }

    function unprotectedDecayBaseRateFromBorrowing() external returns (uint256) {
        s.baseRate = LibTroveManager._calcDecayedBaseRate();
        assert(s.baseRate >= 0 && s.baseRate <= KumoMath.DECIMAL_PRECISION);

        LibTroveManager._updateLastFeeOpTime();
        return s.baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint256) {
        return LibTroveManager._minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        s.lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint256 _baseRate) external {
        s.baseRate = _baseRate;
    }

    function callGetRedemptionFee(
        address _asset,
        uint256 _ETHDrawn
    ) external view returns (uint256) {
        return LibTroveManager._getRedemptionFee(_asset, _ETHDrawn);
    }

    function getActualDebtFromComposite(
        address _asset,
        uint256 _debtVal
    ) external view returns (uint256) {
        return LibKumoBase._getNetDebt(_asset, _debtVal);
    }

    function callInternalRemoveTroveOwner(address _asset, address _troveOwner) external {
        uint256 troveOwnersArrayLength = s.TroveOwners[_asset].length;
        LibTroveManager._removeTroveOwner(_asset, _troveOwner, troveOwnersArrayLength);
    }
}
