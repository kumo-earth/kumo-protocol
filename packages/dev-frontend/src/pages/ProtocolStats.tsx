import React from "react";
import { Flex, Grid } from "theme-ui";
import { StatsPieChart } from "../components/StatsPieChart/StatsPieChart";
import { StatsPriceTVLChart } from "../components/StatsPriceTVLChart/StatsPriceTVLChart";
import { StatsTVCard } from "../components/StatsTVCard/StatsTVCard";

export const ProtocolStats: React.FC = () => {
  return (
    <Flex sx={{ flexDirection: "column", my: 6 }}>
      <Grid sx={{ gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}>
        <StatsTVCard
          title="Total Value Locked"
          data={[
            { name: "BCT TVL", value: "$ 0" },
            { name: "BCT TVL", value: "$ 0" }
          ]}
        />
        <StatsTVCard
          title="Total KUSD Minted"
          data={[
            { name: "BCT Vault", value: "0 KUSD" },
            { name: "BCT Vault", value: "0 KUSD" }
          ]}
        />
      </Grid>
      <Grid sx={{ mt: 8, gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}>
        <StatsPieChart title="KUSD Collateralization" />
        <StatsPieChart title="KUSD Minted by Vault" />
      </Grid>
      <StatsPriceTVLChart />
    </Flex>
  );
};
