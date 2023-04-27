import React, { createContext, useContext, useEffect, useState } from "react";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

type DashboardContextValue = {
  totalCollDebt: {
    totalColl: Decimal;
    totalNBCColl: Decimal;
    totalCSCColl: Decimal;
    totalNBCDebt: Decimal;
    totalCSCDebt: Decimal;
    totalDebt: Decimal;
    totalCarbonCredits: Decimal;
  };
  totalTroveCollDebt: {
    totalTroveColl: Decimal;
    totalTroveDebt: Decimal;
    troveTotalCarbonCredits: Decimal;
  };
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);
const select = ({ vaults }: KumoStoreState) => ({
  vaults
});
export const DashboardProvider: React.FC = ({ children }) => {
  const { vaults } = useKumoSelector(select);
  const [totalCollDebt, setTotalCollDebt] = useState({
    totalColl: Decimal.ZERO,
    totalNBCColl: Decimal.ZERO,
    totalCSCColl: Decimal.ZERO,
    totalNBCDebt: Decimal.ZERO,
    totalCSCDebt: Decimal.ZERO,
    totalDebt: Decimal.ZERO,
    totalCarbonCredits: Decimal.ZERO
  });
  const [totalTroveCollDebt, setTotalTroveCollDebt] = useState({
    totalTroveColl: Decimal.ZERO,
    totalTroveDebt: Decimal.ZERO,
    troveTotalCarbonCredits: Decimal.ZERO
  });

  useEffect(() => {
    let calcCollat = Decimal.ZERO;
    let calcDebt = Decimal.ZERO;
    let totalNBCColl = Decimal.ZERO;
    let totalCSCColl = Decimal.ZERO;
    let totalNBCDebt = Decimal.ZERO;
    let totalCSCDebt = Decimal.ZERO;
    let calcCarbonCredits = Decimal.ZERO;

    let troveCalcCollat = Decimal.ZERO;
    let troveCalcDebt = Decimal.ZERO;
    let troveCarbonCredits = Decimal.ZERO;

    vaults.forEach(vault => {
      const { total, trove, price } = vault;
      calcDebt = calcDebt.add(total.debt);
      troveCalcDebt = troveCalcDebt.add(trove.debt);
      calcCarbonCredits = calcCarbonCredits.add(total.collateral);
      troveCarbonCredits = troveCarbonCredits.add(trove.collateral);
      if (vault.asset === "nbc") {
        totalNBCDebt = totalNBCDebt.add(total.debt);
      } else if (vault.asset === "csc") {
        totalCSCDebt = totalCSCDebt.add(total.debt);
      }
      if (vault.asset === "nbc" && total.collateral.nonZero && price.nonZero) {
        calcCollat = calcCollat.add(total.collateral.mul(price));
        totalNBCColl = totalNBCColl.add(total.collateral.mul(price));
        troveCalcCollat = troveCalcCollat.add(trove.collateral.mul(price));
      } else if (vault.asset === "csc" && total.collateral.nonZero && price.nonZero) {
        calcCollat = calcCollat.add(total.collateral.mul(price));
        totalCSCColl = totalCSCColl.add(total.collateral.mul(price));
        troveCalcCollat = troveCalcCollat.add(trove.collateral.mul(price));
      }
      setTotalCollDebt({
        totalColl: calcCollat,
        totalNBCColl: totalNBCColl,
        totalCSCColl: totalCSCColl,
        totalNBCDebt: totalNBCDebt,
        totalCSCDebt: totalCSCDebt,
        totalDebt: calcDebt,
        totalCarbonCredits: calcCarbonCredits
      });
      setTotalTroveCollDebt({
        totalTroveColl: troveCalcCollat,
        totalTroveDebt: troveCalcDebt,
        troveTotalCarbonCredits: troveCarbonCredits
      });
    });
  }, [vaults]);

  return (
    <DashboardContext.Provider
      value={{
        totalCollDebt,
        totalTroveCollDebt
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const dashboardContext = useContext(DashboardContext);

  if (!dashboardContext) {
    throw new Error("You must provide a DashboardContext via LiquityProvider");
  }

  return dashboardContext;
};
