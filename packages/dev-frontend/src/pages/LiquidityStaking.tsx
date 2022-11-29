import { Grid, Box } from "theme-ui";
import { MiningTypeCard } from "../components/MiningTypeCard/MiningTypeCard";

export const LiquidityStaking: React.FC = () => {
  return (
    <Grid
      sx={{
        width: "100%",
        display: "grid",
        gridGap: 2,
        gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`,
        height: "100%",
        p: 6
      }}
    >
      <MiningTypeCard />
    </Grid>
  );
};
