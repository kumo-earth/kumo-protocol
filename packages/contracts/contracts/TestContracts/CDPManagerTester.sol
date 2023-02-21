// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../TroveManagerDiamond.sol";
import "../Facets/TroveManagerFacet.sol";
import "../Facets/TroveRedemptorFacet.sol";
import "../Dependencies/KumoMath.sol";

import {LibAppStorage, Status, Modifiers} from "../Libraries/LibAppStorage.sol";
import {LibKumoBase} from "../Libraries/LibKumoBase.sol";
import {LibTroveManager} from "../Libraries/LibTroveManager.sol";

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract TroveManagerTester is TroveManagerFacet, TroveRedemptorFacet {
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

    function unprotectedDecayBaseRateFromBorrowing(address _asset) external returns (uint256) {
        s.baseRate[_asset] = LibTroveManager._calcDecayedBaseRate(_asset);
        assert(s.baseRate[_asset] >= 0 && s.baseRate[_asset] <= KumoMath.DECIMAL_PRECISION);

        LibTroveManager._updateLastFeeOpTime(_asset);
        return s.baseRate[_asset];
    }

    function minutesPassedSinceLastFeeOp(address _asset) external view returns (uint256) {
        return LibTroveManager._minutesPassedSinceLastFeeOp(_asset);
    }

    function setLastFeeOpTimeToNow(address _asset) external {
        s.lastFeeOperationTime[_asset] = block.timestamp;
    }

    function setBaseRate(address _asset, uint256 _baseRate) external {
        s.baseRate[_asset] = _baseRate;
    }

    function callGetRedemptionFee(address _asset, uint256 _ETHDrawn)
        external
        view
        returns (uint256)
    {
        return LibTroveManager._getRedemptionFee(_asset, _ETHDrawn);
    }

    function getActualDebtFromComposite(address _asset, uint256 _debtVal)
        external
        view
        returns (uint256)
    {
        return LibKumoBase._getNetDebt(_asset, _debtVal);
    }

    function callInternalRemoveTroveOwner(address _asset, address _troveOwner) external {
        uint256 troveOwnersArrayLength = s.TroveOwners[_asset].length;
        LibTroveManager._removeTroveOwner(_asset, _troveOwner, troveOwnersArrayLength);
    }
}
