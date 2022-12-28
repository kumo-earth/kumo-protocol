// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

struct LiquidationValues {
  uint256 entireTroveDebt;
  uint256 entireTroveColl;
  uint256 collGasCompensation;
  uint256 kusdGasCompensation;
  uint256 debtToOffset;
  uint256 collToSendToSP;
  uint256 debtToRedistribute;
  uint256 collToRedistribute;
  uint256 collSurplus;
}

struct LiquidationTotals {
    uint256 totalCollInSequence;
    uint256 totalDebtInSequence;
    uint256 totalCollGasCompensation;
    uint256 totalkusdGasCompensation;
    uint256 totalDebtToOffset;
    uint256 totalCollToSendToSP;
    uint256 totalDebtToRedistribute;
    uint256 totalCollToRedistribute;
    uint256 totalCollSurplus;
}

// Common interface for the Trove Manager Helpers.
interface ITroveManagerHelpers {
   function _getOffsetAndRedistributionVals(
      uint256 _debt,
      uint256 _coll,
      uint256 _KUSDInStabPool
  )
      external
      pure
      returns (
          uint256 debtToOffset,
          uint256 collToSendToSP,
          uint256 debtToRedistribute,
          uint256 collToRedistribute
      );

  function _addLiquidationValuesToTotals(
      LiquidationTotals memory oldTotals,
      LiquidationValues memory singleLiquidation
  ) external pure returns (LiquidationTotals memory newTotals);

  function _calcRedemptionFee(uint256 _redemptionRate, uint256 _assetDraw)
        external
        pure
        returns (uint256);
}