import { Grid } from "theme-ui";
import { Percent } from "@liquity/lib-base";
import { CollateralCard } from "../components/ColleteralCard/ColleteralCard";
import { useDashboard } from "../hooks/DashboardContext";

export const Dashboard: React.FC = () => {
  const { vaults } = useDashboard();

  return (
    <Grid
      sx={{
        width: "100%",
        display: "grid",
        gridGap: 2,
        gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`,
        height: "100%"
      }}
    >
      {vaults.map(vault => {
        const totalCollateralRatioPct = new Percent(vault.collateralRatio);
        return (
          <CollateralCard
            collateralType={vault.type}
            totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
            total={vault.trove}
            key={vault.type}
          />
        );
      })}
    </Grid>
  );
};
