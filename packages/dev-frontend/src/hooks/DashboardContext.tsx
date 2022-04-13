import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Decimal,
  FrontendStatus,
  LQTYStake,
  Trove,
  LiquityStoreState,
  UserTrove,
  UserTroveStatus,
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

type DashboardContextValue = {
  numberOfTroves: number;
  price: Decimal;
  lusdInStabilityPool: Decimal;
  total: Trove;
  borrowingRate: Decimal;
  totalStakedLQTY: Decimal;
  kickbackRate: Decimal | null;
  frontend: FrontendStatus;
  lqtyStake: LQTYStake;
  selectedTrove: Trove;
  vaults: vaultsType;
  openTroveT: (
    type: string,
    collateral: Decimal,
    borrowAmount: Decimal,
    price: Decimal
  ) => void;
  adjustTroveT: (
    type: string,
    collateral: Decimal,
    netDebt: Decimal,
    collateralRatio: Decimal
  ) => void;
};

type vaultsType = Array<{
  type: string;
  collateralRatio: Decimal;
  troveStatus: UserTroveStatus;
  trove: UserTrove;
}>;

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const select = ({
  trove,
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend,
  lqtyStake
}: LiquityStoreState) => ({
  trove,
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend,
  lqtyStake,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const DashboardProvider: React.FC = ({ children }) => {
  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingRate,
    totalStakedLQTY,
    kickbackRate,
    frontend,
    lqtyStake,
    trove
  } = useLiquitySelector(select);
  const [vaults, setVaults] = useState<vaultsType>([
    {
      type: "bct",
      collateralRatio: Decimal.ZERO,
      troveStatus: 'nonExistent',
      trove: trove
    },
    {
      type: "mco2",
      collateralRatio: Decimal.ZERO,
      troveStatus: 'nonExistent',
      trove: trove
    }
  ]);
  const [selectedTrove, setSelectedTrove] = useState<UserTrove>(trove);

  useEffect(() => {
    const {status } = trove;
    if(status === 'open') {
     const updatedVaults = vaults && vaults.map(vault => {
       if (vault.troveStatus === 'nonExistent') {
         const updatedTrove = new UserTrove(vault.trove.ownerAddress, 'nonExistent',  Decimal.ZERO, Decimal.ZERO);
         return { ...vault, collateralRatio: Decimal.ZERO, trove: updatedTrove };
       }
       return vault;
     });
      setVaults(updatedVaults)
    }
  }, [trove])
  

  const adjustTroveT = (
    type: string,
    collateral: Decimal,
    netDebt: Decimal,
    price: Decimal

  ): void => {
    const updatedVaults = vaults && vaults.map(vault => {
      if (vault.type === type) {
        const updatedTrove = new UserTrove(vault.trove.ownerAddress, 'open',  collateral, netDebt);
        const collateralRatio = updatedTrove.collateralRatio(price)
        return { ...vault, collateralRatio: collateralRatio, trove: updatedTrove };
      }
      return vault;
    });
    setVaults(updatedVaults);
  };  
   
  const openTroveT = (
    type: string,
    collateral: Decimal,
    borrowAmount: Decimal,
    price: Decimal

  ): void => {
    const updatedVaults = vaults && vaults.map(vault => {
      if (vault.type === type) {
        const updatedTrove = new UserTrove(vault.trove.ownerAddress, 'open',  collateral, borrowAmount);
        const collateralRatio = updatedTrove.collateralRatio(price)
        return { ...vault, troveStatus: updatedTrove.status, collateralRatio: collateralRatio, trove: updatedTrove };
      }
      return vault;
    });
    setVaults(updatedVaults);
  };  
  
  return (
    <DashboardContext.Provider
      value={{
        numberOfTroves,
        price,
        lusdInStabilityPool,
        total,
        borrowingRate,
        totalStakedLQTY,
        kickbackRate,
        frontend,
        lqtyStake,
        selectedTrove: selectedTrove ? selectedTrove : trove,
        vaults,
        openTroveT,
        adjustTroveT,
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
