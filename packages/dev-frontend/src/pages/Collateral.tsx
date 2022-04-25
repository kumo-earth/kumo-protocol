import { Container, Grid, Card, Image, Text, Flex } from "theme-ui";
import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../hooks/LiquityContext";
import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { Staking } from "../components/Staking/Staking";
import { CollateralCard } from "../components/ColleteralCard/ColleteralCard";

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
        <SystemStats />
        <Stability />
      </Flex>
    </Grid>
  );
};
