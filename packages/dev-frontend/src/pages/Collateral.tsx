import { Grid, Flex } from "theme-ui";
import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { SystemStats } from "../components/SystemStats"
import { PriceManager } from "../components/PriceManager";

export const Collateral: React.FC = () => {
  return (
    <Grid
      columns={[2, "1fr 1fr"]}
      sx={{
        width: "100%",
        gridGap: 2,
        py: 5
      }}
    >
      <Flex sx={{ height: "max-content", width: "95%" }}>
        <Trove />
      </Flex>
      <Flex sx={{ flexDirection: "column", width: "95%"  }}>
        <SystemStats />
        <Stability />
        <PriceManager />
      </Flex>
    </Grid>
  );
};
