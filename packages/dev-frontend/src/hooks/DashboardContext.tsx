import React, { createContext, useContext, useEffect, useState } from "react";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { getTokenPrice } from "../tokensPrice";

type DashboardContextValue = {
  ctx: Decimal;
  cty: Decimal;
  totalCollDebt: { totalColl: Decimal; totalDebt: Decimal; totalCarbonCredits: Decimal };
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

  useEffect(() => {
    let calcCollat = Decimal.ZERO;
    let calcDebt = Decimal.ZERO;
    let calcCarbonCredits = Decimal.ZERO;

    vaults.forEach(vault => {
      const { trove } = vault;
      calcDebt = calcDebt.add(trove.debt);
      calcCarbonCredits = calcCarbonCredits.add(trove.collateral);
      if (vault.asset === "ctx" && trove.collateral.nonZero && ctx.nonZero) {
        calcCollat = calcCollat.add(trove.collateral.mul(ctx));
      } else if (vault.asset === "cty" && trove.collateral.nonZero && cty.nonZero) {
        calcCollat = calcCollat.add(trove.collateral.mul(cty));
      }
      setTotalCollDebt({
        totalColl: calcCollat,
        totalDebt: calcDebt,
        totalCarbonCredits: calcCarbonCredits
      });
    });
  }, [vaults, ctx, cty]);
  useEffect(() => {
    setPrices();
  }, []);

  const setPrices = async () => {
    const bctResponse = await getTokenPrice("toucan-protocol-base-carbon-tonne");
    setCTX(bctResponse.data);
    const mco2Response = await getTokenPrice("moss-carbon-credit");
    setCTY(mco2Response.data);
  };

  return (
    <DashboardContext.Provider
      value={{
        totalCollDebt,
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
