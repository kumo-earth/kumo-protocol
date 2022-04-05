import { Container, Grid, Card, Image, Text, Flex } from "theme-ui";
import { StakingTypeCard } from "../components/StakingTypeCard/StakingTypeCard";

export const StakingType: React.FC = () => {
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
      <StakingTypeCard collateralType={"eth"} />
    </Grid>
  );
};
