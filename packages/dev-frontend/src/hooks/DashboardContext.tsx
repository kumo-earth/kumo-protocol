import React, { createContext, useContext, useEffect, useState } from "react";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

type DashboardContextValue = {
  totalCollDebt: {
    totalColl: Decimal;
    totalCTXColl: Decimal;
    totalCTYColl: Decimal;
    totalCTXDebt: Decimal;
    totalCTYDebt: Decimal;
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
    totalCTXColl: Decimal.ZERO,
    totalCTYColl: Decimal.ZERO,
    totalCTXDebt: Decimal.ZERO,
    totalCTYDebt: Decimal.ZERO,
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
    let totalCTXColl = Decimal.ZERO;
    let totalCTYColl = Decimal.ZERO;
    let totalCTXDebt = Decimal.ZERO;
    let totalCTYDebt = Decimal.ZERO;
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
      if (vault.asset === "ctx") {
        totalCTXDebt = totalCTXDebt.add(total.debt);
      } else if (vault.asset === "cty") {
        totalCTYDebt = totalCTYDebt.add(total.debt);
      }
      if (vault.asset === "ctx" && total.collateral.nonZero && price.nonZero) {
        calcCollat = calcCollat.add(total.collateral.mul(price));
        totalCTXColl = totalCTXColl.add(total.collateral.mul(price));
        troveCalcCollat = troveCalcCollat.add(trove.collateral.mul(price));
      } else if (vault.asset === "cty" && total.collateral.nonZero && price.nonZero) {
        calcCollat = calcCollat.add(total.collateral.mul(price));
        totalCTYColl = totalCTYColl.add(total.collateral.mul(price));
        troveCalcCollat = troveCalcCollat.add(trove.collateral.mul(price));
      }
      setTotalCollDebt({
        totalColl: calcCollat,
        totalCTXColl: totalCTXColl,
        totalCTYColl: totalCTYColl,
        totalCTXDebt: totalCTXDebt,
        totalCTYDebt: totalCTYDebt,
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
