import { Divider, Flex } from "theme-ui";
import { Percent } from "@kumodao/lib-base";
import { CollateralCard } from "../components/ColleteralCard/ColleteralCard";
import { DashboadHeader } from "../components/DashboardHeader";
import { useDashboard } from "../hooks/DashboardContext";
import { DashboadHeaderItem } from "../components/DashboardHeaderItem";
import { DashboadContent } from "../components/DashboardContent";

export const Dashboard: React.FC = () => {
  const { vaults, totalCollDebt } = useDashboard();
  console.log("statsType1", vaults)
  return (
    <Flex variant="layout.dashboard">
      <DashboadHeader>
        <DashboadHeaderItem  title={"TOTAL COLLATERAL"} value={`$${totalCollDebt.totalColl.prettify(0)}`} />
        <DashboadHeaderItem  title={"TOTAL DEBT"} value={`$${totalCollDebt.totalDebt.prettify(0)}`} />
        <DashboadHeaderItem  title={"TOTAL CARBON CREDITS"} value={totalCollDebt.totalCarbonCredits.prettify(0)} />
      </DashboadHeader>
      <Divider  sx={{ color: "muted" }} />
      <DashboadContent>
        {vaults.map(vault => {
          const totalCollateralRatioPct = new Percent(vault.collateralRatio);
          return (
            <CollateralCard
              collateralType={vault.type}
              totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
              usersTroves={vault.usersTroves}
              key={vault.type}
            />
          );
        })}
      </DashboadContent>
    </Flex>
  );
};
