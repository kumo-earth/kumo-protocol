import React from "react";
import { Flex, Grid } from "theme-ui";
import { StatsPieChart } from "../components/StatsPieChart/StatsPieChart";
import { StatsPriceTVLChart } from "../components/StatsPriceTVLChart/StatsPriceTVLChart";
import { StatsTVCard } from "../components/StatsTVCard/StatsTVCard";
import { useDashboard } from "../hooks/DashboardContext";

export const ProtocolStats: React.FC = () => {
  const { totalCollDebt } = useDashboard();
  return (
    <Flex sx={{ flexDirection: "column", my: 6 }}>
      <Grid sx={{ gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}>
        <StatsTVCard
          title="Total Value Locked"
          totalValueLocked={totalCollDebt?.totalColl}
          data={[
            { name: "CTX TVL", value: `$ ${totalCollDebt?.totalCTXColl.prettify(0)}` },
            { name: "CTY TVL", value: `$ ${totalCollDebt?.totalCTYColl.prettify(0)}` }
          ]}
        />
        <StatsTVCard
          title="Total KUSD Minted"
          totalValueLocked={totalCollDebt?.totalDebt}
          data={[
            { name: "CTX Vault", value: `${totalCollDebt.totalCTXDebt.prettify(0)} KUSD` },
            { name: "CTX Vault", value: `${totalCollDebt.totalCTYDebt.prettify(0)} KUSD` }
          ]}
        />
      </Grid>
      <Grid sx={{ mt: 8, gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}>
        <StatsPieChart title="KUSD Collateralization" data={ [{ name: "CTX", value : `${totalCollDebt?.totalCTXColl.prettify(0)}` },  { name: "CTY", value: `${totalCollDebt?.totalCTYColl.prettify(0)}`} ]}/>
        <StatsPieChart title="KUSD Minted by Vault" data={ [{ name: "CTX", value: `${totalCollDebt.totalCTXDebt.prettify(0)} KUSD` },  { name: "CTY", value: `${totalCollDebt.totalCTYDebt.prettify(0)} KUSD` }]} />
      </Grid>
      <StatsPriceTVLChart />
    </Flex>
  );
};
