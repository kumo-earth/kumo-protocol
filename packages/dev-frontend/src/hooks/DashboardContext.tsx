import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Decimal,
  FrontendStatus,
  KUMOStake,
  Trove,
  KumoStoreState,
  UserTrove,
  StabilityDeposit
} from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";
import { getTokenPrice } from "../tokensPrice";

type StabilityDepositChange = {
  depositKUSD: Decimal | undefined;
  withdrawKUSD: Decimal | undefined;
  withdrawAllKUSD: boolean;
};

type DashboardContextValue = {
  numberOfTroves: number;
  price: Decimal;
  kusdInStabilityPool: Decimal;
  total: Trove;
  borrowingRate: Decimal;
  totalStakedKUMO: Decimal;
  kickbackRate: Decimal | null;
  frontend: FrontendStatus;
  kumoStake: KUMOStake;
  selectedTrove: Trove;
  vaults: vaultsType;
  totalCollDebt: { totalColl: Decimal; totalDebt: Decimal; totalCarbonCredits: Decimal };
  depositKusd: StabilityDepositChange;
  handleDepositKusd: (
    depositKUSD: Decimal | undefined,
    withdrawKUSD: Decimal | undefined,
    withdrawAllKUSD: boolean
  ) => void;
  openTroveT: (type: string, collateral: Decimal, borrowAmount: Decimal, price: Decimal) => void;
  adjustTroveT: (
    type: string,
    troveOwner: string,
    collateral: Decimal,
    netDebt: Decimal,
    collateralRatio: Decimal
  ) => void;
  openStabilityDeposit: (type: string, amount: Decimal) => void;
  bctPrice: Decimal;
  mco2Price: Decimal;
};

type vaultsType = Array<{
  type: string;
  collateralRatio: Decimal;
  stabilityStatus: Boolean;
  usersTroves: UserTrove[];
  stabilityDeposit: StabilityDeposit;
}>;

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const select = ({
  trove,
  numberOfTroves,
  price,
  total,
  kusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedKUMO,
  frontend,
  kumoStake,
  stabilityDeposit
}: KumoStoreState) => ({
  trove,
  numberOfTroves,
  price,
  total,
  kusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedKUMO,
  frontend,
  kumoStake,
  stabilityDeposit,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const DashboardProvider: React.FC = ({ children }) => {
  const {
    numberOfTroves,
    price,
    kusdInStabilityPool,
    total,
    borrowingRate,
    totalStakedKUMO,
    kickbackRate,
    frontend,
    kumoStake,
    trove,
    stabilityDeposit
  } = useKumoSelector(select);
  const [vaults, setVaults] = useState<vaultsType>([
    {
      type: "bct",
      collateralRatio: Decimal.ZERO,
      stabilityStatus: true,
      usersTroves: [],
      stabilityDeposit: stabilityDeposit
    },
    {
      type: "mco2",
      collateralRatio: Decimal.ZERO,
      stabilityStatus: true,
      usersTroves: [],
      stabilityDeposit: stabilityDeposit
    }
  ]);
  const [selectedTrove] = useState<UserTrove>(trove);
  const [depositKusd, setDepositKusd] = useState<StabilityDepositChange>({
    depositKUSD: undefined,
    withdrawKUSD: undefined,
    withdrawAllKUSD: false
  });
  const [totalCollDebt, setTotalCollDebt] = useState({
    totalColl: Decimal.ZERO,
    totalDebt: Decimal.ZERO,
    totalCarbonCredits: Decimal.ZERO
  });
  const [bctPrice, setBctPrice] = useState<Decimal>(Decimal.ZERO);
  const [mco2Price, setMco2Price] = useState<Decimal>(Decimal.ZERO);
  const { account } = useWeb3React<Web3Provider>();

  const decimalConvertor = (bigNumber: Decimal) => {
    return Decimal.fromBigNumberString(bigNumber["_bigNumber"]);
  };

  useEffect(() => {
    const { status } = trove;
    if (status === "open") {
      const updatedVaults =
        vaults &&
        vaults.map(vault => {
          if (stabilityDeposit.isEmpty === true) {
            const updatedStabilityDeposit = new StabilityDeposit(
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              ""
            );
            return {
              ...vault,
              stabilityStatus: true,
              collateralRatio: vault.collateralRatio,
              stabilityDeposit: updatedStabilityDeposit
            };
          }

          return vault;
        });
      setVaults(updatedVaults);
    }
  }, [trove]);

  // localStorage.removeItem("vaults");
  // localStorage.removeItem("totalCollDebt");
  // localStorage.removeItem("depositKusd");

  useEffect(() => {
    const localStorageVaults = localStorage.getItem("vaults");
    const localStorageTotalCollDebt = localStorage.getItem("totalCollDebt");
    const localStorageDepositKusd = localStorage.getItem("depositKusd");
    if (localStorageVaults) {
      const items = JSON.parse(localStorageVaults) as vaultsType;
      const updatedVaults = items.map(vlt => {
        return {
          type: vlt.type,
          collateralRatio: decimalConvertor(vlt.collateralRatio),
          stabilityStatus: vlt.stabilityStatus,
          usersTroves: vlt.usersTroves.map(userT => {
            return new UserTrove(
              userT.ownerAddress,
              userT.status,
              decimalConvertor(userT.collateral),
              decimalConvertor(userT.debt)
            );
          }),
          stabilityDeposit: new StabilityDeposit(
            decimalConvertor(vlt.stabilityDeposit.initialKUSD),
            decimalConvertor(vlt.stabilityDeposit.currentKUSD),
            decimalConvertor(vlt.stabilityDeposit.collateralGain),
            decimalConvertor(vlt.stabilityDeposit.kumoReward),
            vlt.stabilityDeposit.frontendTag
          )
        };
      });
      setVaults(updatedVaults);
    }
    if (localStorageTotalCollDebt) {
      const item = JSON.parse(localStorageTotalCollDebt) as {
        totalColl: Decimal;
        totalDebt: Decimal;
        totalCarbonCredits: Decimal;
      };
      const updatedTotalCollDebt = {
        totalColl: decimalConvertor(item.totalColl),
        totalDebt: decimalConvertor(item.totalDebt),
        totalCarbonCredits: decimalConvertor(item.totalCarbonCredits)
      };
      setTotalCollDebt(updatedTotalCollDebt);
    }
    if (localStorageDepositKusd) {
      const stabilityDeposit = JSON.parse(localStorageDepositKusd) as StabilityDepositChange;
      const updatedStabilityDeposit = {
        depositKUSD: stabilityDeposit.depositKUSD
          ? decimalConvertor(stabilityDeposit.depositKUSD)
          : undefined,
        withdrawKUSD: stabilityDeposit.withdrawKUSD
          ? decimalConvertor(stabilityDeposit.withdrawKUSD)
          : undefined,
        withdrawAllKUSD: stabilityDeposit.withdrawAllKUSD
      };
      setDepositKusd(updatedStabilityDeposit as StabilityDepositChange);
    }
  }, []);

  useEffect(() => {
    let calcCollat = Decimal.ZERO;
    let calcDebt = Decimal.ZERO;
    let calcCarbonCredits = Decimal.ZERO;

    vaults.forEach(vault => {
      vault.usersTroves.forEach(userTrove => {
        calcDebt = calcDebt.add(userTrove.debt);
        calcCarbonCredits = calcCarbonCredits.add(userTrove.collateral);
        if (vault.type === "bct" && userTrove.collateral.nonZero && bctPrice.nonZero) {
          calcCollat = calcCollat.add(userTrove.collateral.mul(bctPrice));
        } else if (vault.type === "mco2" && userTrove.collateral.nonZero && mco2Price.nonZero) {
          calcCollat = calcCollat.add(userTrove.collateral.mul(mco2Price));
        }
        setTotalCollDebt({
          totalColl: calcCollat,
          totalDebt: calcDebt,
          totalCarbonCredits: calcCarbonCredits
        });
        localStorage.setItem(
          "totalCollDebt",
          JSON.stringify({
            totalColl: calcCollat,
            totalDebt: calcDebt,
            totalCarbonCredits: calcCarbonCredits
          })
        );
      });
    });
  }, [vaults, bctPrice, mco2Price]);

  useEffect(() => {
    setPrices();
  }, []);

  const setPrices = async () => {
    const bctResponse = await getTokenPrice("toucan-protocol-base-carbon-tonne");
    setBctPrice(bctResponse.data);
    const mco2Response = await getTokenPrice("moss-carbon-credit");
    setMco2Price(mco2Response.data);
  };

  const handleDepositKusd = (
    depositKUSD: Decimal | undefined,
    withdrawKUSD: Decimal | undefined,
    withdrawAllKUSD: boolean
  ) => {
    setDepositKusd({ depositKUSD, withdrawKUSD, withdrawAllKUSD });
    localStorage.setItem(
      "depositKusd",
      JSON.stringify({ depositKUSD, withdrawKUSD, withdrawAllKUSD })
    );
  };

  const adjustTroveT = (
    type: string,
    troveOwner: string,
    collateral: Decimal,
    totalDebt: Decimal,
    netDebt: Decimal
  ): void => {
    const updatedVaults =
      vaults &&
      vaults.map(vault => {
        if (vault.type === type) {
          const { usersTroves } = vault;
          const updatedTrove = new UserTrove(troveOwner, "open", collateral, totalDebt);

          updatedTrove.netDebt.sub(updatedTrove.netDebt);
          updatedTrove.netDebt.add(netDebt);
          let collateralRatio = Decimal.ZERO;

          if (type === "bct") {
            usersTroves.forEach(userTrove => {
              if (userTrove.ownerAddress === updatedTrove.ownerAddress) {
                collateralRatio = collateralRatio.add(updatedTrove.collateralRatio(bctPrice));
              } else {
                collateralRatio = collateralRatio.add(userTrove.collateralRatio(bctPrice));
              }
            });
          } else if (type === "mco2") {
            usersTroves.forEach(userTrove => {
              if (userTrove.ownerAddress === troveOwner) {
                collateralRatio = collateralRatio.add(updatedTrove.collateralRatio(mco2Price));
              } else {
                collateralRatio = collateralRatio.add(userTrove.collateralRatio(mco2Price));
              }
            });
          }

          const updatedUserTroves = usersTroves.map(uTrove => {
            if (uTrove.ownerAddress === troveOwner) {
              return updatedTrove;
            }
            return uTrove;
          });

          return {
            ...vault,
            collateralRatio: collateralRatio,
            usersTroves: [...updatedUserTroves]
          };
        }
        return vault;
      });
    setVaults(updatedVaults);
    localStorage.setItem("vaults", JSON.stringify(updatedVaults));
  };

  const openTroveT = (
    type: string,
    collateral: Decimal,
    totalDebt: Decimal,
    netDebt: Decimal
  ): void => {
    const updatedVaults =
      vaults &&
      vaults.map(vault => {
        if (vault.type === type) {
          const { usersTroves } = vault;
          const updatedTrove = new UserTrove(account || "0x0", "open", collateral, totalDebt);
          updatedTrove.netDebt.add(netDebt);
          let collateralRatio = Decimal.ZERO;
          if (type === "bct") {
            usersTroves.forEach(userTrove => {
              collateralRatio = collateralRatio.add(userTrove.collateralRatio(bctPrice));
            });
            collateralRatio = collateralRatio.add(updatedTrove.collateralRatio(bctPrice));
          } else if (type === "mco2") {
            usersTroves.forEach(userTrove => {
              collateralRatio = collateralRatio.add(userTrove.collateralRatio(mco2Price));
            });
            collateralRatio = collateralRatio.add(updatedTrove.collateralRatio(mco2Price));
          }
          return {
            ...vault,
            collateralRatio: collateralRatio,
            usersTroves: [...vault.usersTroves, updatedTrove]
          };
        }
        return vault;
      });
    setVaults(updatedVaults);
    localStorage.setItem("vaults", JSON.stringify(updatedVaults));
  };
  const openStabilityDeposit = (type: string, amount: Decimal): void => {
    const updatedVaults =
      vaults &&
      vaults.map(vault => {
        if (vault.usersTroves.length > 0 && vault.type === type) {
          const updatedStabilityDeposit = new StabilityDeposit(
            amount,
            amount,
            Decimal.ZERO,
            Decimal.ZERO,
            "0x0000000000000000000000000000000000000000"
          );
          return {
            ...vault,
            stabilityStatus: false,
            stabilityDeposit: updatedStabilityDeposit
          };
        }
        return vault;
      });
    setVaults(updatedVaults);
    localStorage.setItem("vaults", JSON.stringify(updatedVaults));
  };

  return (
    <DashboardContext.Provider
      value={{
        numberOfTroves,
        price,
        kusdInStabilityPool,
        total,
        borrowingRate,
        totalStakedKUMO,
        kickbackRate,
        frontend,
        kumoStake,
        depositKusd,
        handleDepositKusd,
        selectedTrove: selectedTrove ? selectedTrove : trove,
        vaults,
        totalCollDebt,
        openTroveT,
        adjustTroveT,
        openStabilityDeposit,
        bctPrice,
        mco2Price
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
