import { Grid, Flex } from "theme-ui";
import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { SystemStats } from "../components/SystemStats";

export const Collateral: React.FC = () => {
  return (
    <Grid
      columns={[2, "1fr 1fr"]}
      sx={{
        width: "100%",
        gridGap: 2,
        height: "100%"
      }}
    >
      <Flex sx={{ height: "max-content" }}>
        <Trove />
      </Flex>
      <Flex sx={{ flexDirection: "column" }}>
        {/* <SystemStats /> */}
        <Stability />
      </Flex>
    </Grid>
  );
};
