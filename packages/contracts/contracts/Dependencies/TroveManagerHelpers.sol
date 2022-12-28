// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./KumoMath.sol";
import "./SafeMath.sol";
import "../Interfaces/ITroveManagerHelpers.sol";

library TroveManagerHelpers {
  using SafeMath for uint256;

  uint256 constant public DECIMAL_PRECISION = 1e18;

  /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
  * redistributed to active troves.
  */
  function _getOffsetAndRedistributionVals(
      uint256 _debt,
      uint256 _coll,
      uint256 _KUSDInStabPool
  )
      public
      pure
      returns (
          uint256 debtToOffset,
          uint256 collToSendToSP,
          uint256 debtToRedistribute,
          uint256 collToRedistribute
      )
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

  function _addLiquidationValuesToTotals(
      LiquidationTotals memory oldTotals,
      LiquidationValues memory singleLiquidation
  ) public pure returns (LiquidationTotals memory newTotals) {
      // Tally all the values with their respective running totals
      newTotals.totalCollGasCompensation = oldTotals.totalCollGasCompensation.add(
          singleLiquidation.collGasCompensation
      );
      newTotals.totalkusdGasCompensation = oldTotals.totalkusdGasCompensation.add(
          singleLiquidation.kusdGasCompensation
      );
      newTotals.totalDebtInSequence = oldTotals.totalDebtInSequence.add(
          singleLiquidation.entireTroveDebt
      );
      newTotals.totalCollInSequence = oldTotals.totalCollInSequence.add(
          singleLiquidation.entireTroveColl
      );
      newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset.add(
          singleLiquidation.debtToOffset
      );
      newTotals.totalCollToSendToSP = oldTotals.totalCollToSendToSP.add(
          singleLiquidation.collToSendToSP
      );
      newTotals.totalDebtToRedistribute = oldTotals.totalDebtToRedistribute.add(
          singleLiquidation.debtToRedistribute
      );
      newTotals.totalCollToRedistribute = oldTotals.totalCollToRedistribute.add(
          singleLiquidation.collToRedistribute
      );
      newTotals.totalCollSurplus = oldTotals.totalCollSurplus.add(singleLiquidation.collSurplus);

      return newTotals;
  }

  function _calcRedemptionFee(uint256 _redemptionRate, uint256 _assetDraw)
        public
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
}