import React, { createContext, useContext, useEffect, useState } from "react";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { getTokenPrice } from "../tokensPrice";

type DashboardContextValue = {
  ctx: Decimal;
  cty: Decimal;
  totalCollDebt: { totalColl: Decimal; totalDebt: Decimal; totalCarbonCredits: Decimal };
  totalTroveCollDebt : {totalTroveColl: Decimal, totalTroveDebt: Decimal }
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);
const select = ({ vaults }: KumoStoreState) => ({
  vaults
});
export const DashboardProvider: React.FC = ({ children }) => {
  const { vaults } = useKumoSelector(select);
  const [ctx, setCTX] = useState<Decimal>(Decimal.ZERO);
  const [cty, setCTY] = useState<Decimal>(Decimal.ZERO);
  const [totalCollDebt, setTotalCollDebt] = useState({
    totalColl: Decimal.ZERO,
    totalDebt: Decimal.ZERO,
    totalCarbonCredits: Decimal.ZERO
  });
  const [totalTroveCollDebt, setTotalTroveCollDebt] = useState({
    totalTroveColl: Decimal.ZERO,
    totalTroveDebt: Decimal.ZERO
  });

  useEffect(() => {
    let calcCollat = Decimal.ZERO;
    let calcDebt = Decimal.ZERO;
    let calcCarbonCredits = Decimal.ZERO;

    let troveCalcCollat = Decimal.ZERO;
    let troveCalcDebt = Decimal.ZERO;

    vaults.forEach(vault => {
      const { total, trove } = vault;
      calcDebt = calcDebt.add(total.debt);
      troveCalcDebt = troveCalcDebt.add(trove.debt);
      calcCarbonCredits = calcCarbonCredits.add(total.collateral);
      if (vault.asset === "ctx" && total.collateral.nonZero && ctx.nonZero) {
        calcCollat = calcCollat.add(total.collateral.mul(ctx));
        troveCalcCollat = troveCalcCollat.add(trove.collateral.mul(ctx));
      } else if (vault.asset === "cty" && total.collateral.nonZero && cty.nonZero) {
        calcCollat = calcCollat.add(total.collateral.mul(cty));
        troveCalcCollat = troveCalcCollat.add(trove.collateral.mul(cty));
      }
      setTotalCollDebt({
        totalColl: calcCollat,
        totalDebt: calcDebt,
        totalCarbonCredits: calcCarbonCredits
      });
      setTotalTroveCollDebt({
        totalTroveColl: troveCalcCollat,
        totalTroveDebt: troveCalcDebt
      });
    });
  }, [vaults, ctx, cty]);

  useEffect(() => {
    setPrices();
  }, []);

  const setPrices = async () => {
    const ctxResponse = await getTokenPrice("toucan-protocol-base-carbon-tonne");
    setCTX(ctxResponse.data);
    const ctyResponse = await getTokenPrice("moss-carbon-credit");
    setCTY(ctyResponse.data);
  };

  return (
    <DashboardContext.Provider
      value={{
        totalCollDebt,
        totalTroveCollDebt,
        ctx,
        cty
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
