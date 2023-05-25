import React, { createContext, useContext, useEffect, useState } from "react";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

type DashboardContextValue = {
  assetTotalCollDebt : { [key: string]: { assetCollateral: Decimal, assetDebt: Decimal } } | undefined;
  systemTotalCollDebt: {
    systemTotalCollateral: Decimal,
    systemTotalDebt: Decimal,
    systemTotalCarbonCredits : Decimal,
  };
  totalTroveCollDebt: {
    totalTroveColl: Decimal,
    totalTroveDebt: Decimal,
    troveTotalCarbonCredits: Decimal
  };
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);
const select = ({ vaults }: KumoStoreState) => ({
  vaults
});


export const DashboardProvider: React.FC = ({ children }) => {
  const { vaults } = useKumoSelector(select);
  const [assetTotalCollDebt, setAssetTotalCollDebt] = useState<{ [key: string]: { assetCollateral: Decimal, assetDebt: Decimal } }>();

  const [systemTotalCollDebt, setSystemTotalCollDebt] = useState({
    systemTotalCollateral: Decimal.ZERO,
    systemTotalDebt: Decimal.ZERO,
    systemTotalCarbonCredits : Decimal.ZERO,
  });
  const [totalTroveCollDebt, setTotalTroveCollDebt] = useState({
    totalTroveColl: Decimal.ZERO,
    totalTroveDebt: Decimal.ZERO,
    troveTotalCarbonCredits: Decimal.ZERO
  });


  useEffect(() => {
    let systemTotalCollateral = Decimal.ZERO;
    let systemTotalDebt = Decimal.ZERO;

    let systemTotalCarbonCredits = Decimal.ZERO;
    let totalTroveColl = Decimal.ZERO;
    let totalTroveDebt = Decimal.ZERO;
    let troveTotalCarbonCredits = Decimal.ZERO;


    vaults.forEach(vault => {
      const { total, trove, price, asset } = vault;

      systemTotalCollateral = systemTotalCollateral.add(total.collateral.mul(price))
      systemTotalDebt = systemTotalDebt.add(total.debt);
      systemTotalCarbonCredits = systemTotalCarbonCredits.add(total.collateral);

      totalTroveColl = totalTroveColl.add(trove.collateral.mul(price));
      totalTroveDebt = totalTroveDebt.add(trove.debt);
      troveTotalCarbonCredits = troveTotalCarbonCredits.add(trove.collateral);


      let assetCollateralDebt = {
        assetCollateral: total.collateral.mul(price),
        assetDebt: total.debt,
      };

      setAssetTotalCollDebt((prevTotalValues) => {
        return {
          ...prevTotalValues,
          [asset]: assetCollateralDebt,
        };
      });


      setSystemTotalCollDebt({
        systemTotalCollateral,
        systemTotalDebt,
        systemTotalCarbonCredits
      });

      setTotalTroveCollDebt({
        totalTroveColl,
        totalTroveDebt,
        troveTotalCarbonCredits
      });
    });

  }, [vaults]);


  return (
    <DashboardContext.Provider
      value={{
        assetTotalCollDebt,
        systemTotalCollDebt,
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
    throw new Error("You must provide a DashboardContext via kumoProvider");
  }

  return dashboardContext;
};
