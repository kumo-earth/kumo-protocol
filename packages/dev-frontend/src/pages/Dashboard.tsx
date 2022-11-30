import { Divider, Flex } from "theme-ui";
import { KumoStoreState, Percent, Decimal, Trove } from "@kumodao/lib-base";
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
  const { totalCollDebt, ctx, cty } = useDashboard();
  const { vaults } = useKumoSelector(select);
  return (
    <Flex variant="layout.dashboard">
      <DashboadHeader>
        <DashboadHeaderItem  title={"TOTAL COLLATERAL"} value={`$${totalCollDebt.totalColl.prettify(0)}`} />
        <DashboadHeaderItem  title={"TOTAL MINTED KUSD"} value={`$${totalCollDebt.totalDebt.prettify(0)}`} />
        <DashboadHeaderItem  title={"TOTAL CARBON CREDITS"} value={totalCollDebt.totalCarbonCredits.prettify(0)} />
      </DashboadHeader>
      <Divider  sx={{ color: "muted" }} />
      <DashboadContent>
        {vaults.map(vault => {
          const price = vault?.asset === 'ctx' ? ctx : vault?.asset === 'cty' ? cty : Decimal.from(0)
          const total = vault.total
          const kusdInStabilityPool = vault.kusdInStabilityPool;
          const borrowingRate = vault.borrowingRate;
          const totalCollateralRatioPct = !vault?.total?.isEmpty ? new Percent(vault.total.collateralRatio(price)).prettify() : "0.00%";
          return (
            <CollateralCard
              collateralType={vault.asset}
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
