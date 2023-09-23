import React from "react";
import { Divider, Flex } from "theme-ui";
import { KumoStoreState, Percent, Decimal } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { CollateralCard } from "../components/ColleteralCard/ColleteralCard";
import { DashboadHeader } from "../components/DashboardHeader";
import { useDashboard } from "../hooks/DashboardContext";
import { DashboadHeaderItem } from "../components/DashboardHeaderItem";
import { DashboadContent } from "../components/DashboardContent";


const select = ({
  vaults
}: KumoStoreState) => ({
  vaults
});

export const Dashboard: React.FC = () => {
  const { systemTotalCollDebt } = useDashboard();
  const { vaults } = useKumoSelector(select);
  return (
    <Flex variant="layout.dashboard">
      <DashboadHeader>
        <DashboadHeaderItem title={"TOTAL COLLATERAL"} value={`$${systemTotalCollDebt.systemTotalCollateral.prettify(0)}`} />
        <DashboadHeaderItem title={"TOTAL MINTED KUSD"} value={`$${systemTotalCollDebt.systemTotalDebt.prettify(0)}`} />
        <DashboadHeaderItem title={"TOTAL CARBON CREDITS"} value={systemTotalCollDebt.systemTotalCarbonCredits.prettify(0)} />
      </DashboadHeader>
      <Divider sx={{ color: "muted" }} />
      <DashboadContent>
        {vaults.map(vault => {
          const price = vault?.price
          const total = vault.total
          const kusdInStabilityPool = vault.kusdInStabilityPool;
          const borrowingRate = vault.borrowingRate;
          const totalCollateralRatioPct = !vault?.total?.isEmpty ? new Percent(vault.total.collateralRatio(price)).toString(0) : `${Decimal.from(0).prettify(0)} %`;

          return (
            <CollateralCard
              collateralType={vault.asset}
              vaultName={vault.assetName}
              totalCollateralRatioPct={totalCollateralRatioPct}
              total={total}
              kusdInStabilityPool={kusdInStabilityPool}
              borrowingRate={borrowingRate}
              kusdMintedCap={vault?.kusdMintedCap}
              key={vault?.asset}
            />
          );
        })}
      </DashboadContent>
    </Flex>
  );
};
