import { parseInt } from "lodash";
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
      <Grid sx={{ gridGap: [2, 4],  gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`, }}>
        <StatsTVCard
          title="Total Value Locked"
          totalValueLocked={totalCollDebt?.totalColl}
          data={[
            { name: "NBC TVL", value: `$ ${totalCollDebt?.totalNBCColl.prettify(0)}` },
            { name: "CSC TVL", value: `$ ${totalCollDebt?.totalCSCColl.prettify(0)}` }
          ]}
          key={"1"}
        />
        <StatsTVCard
          title="Total KUSD Minted"
          totalValueLocked={totalCollDebt?.totalDebt}
          data={[
            { name: "NBC Vault", value: `${totalCollDebt.totalNBCDebt.prettify(0)} KUSD` },
            { name: "CSC Vault", value: `${totalCollDebt.totalCSCDebt.prettify(0)} KUSD` }
          ]}
          key={"2"}
        />
      </Grid>
      <Grid sx={{ mt: 8, gridGap: 4, gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`, }}>
        <StatsPieChart
          title="KUSD Collateralization"
          data={[
            { name: "NBC", symbol: '$',  value: parseInt(totalCollDebt?.totalNBCColl.toString())},
            { name: "CSC", symbol: '$', value:  parseInt(totalCollDebt?.totalCSCColl.toString()) }
          ]}
          key={"1"}
        />
        <StatsPieChart
          title="KUSD Minted by Vault"
          data={[
            { name: "NBC", symbol: 'KUSD',  value: parseInt(totalCollDebt.totalNBCDebt.toString()) },
            { name: "CSC", symbol: 'KUSD', value: parseInt(totalCollDebt.totalCSCDebt.toString()) }
          ]}
          key={"2"}
        />
      </Grid>
      <StatsPriceTVLChart />
    </Flex>
  );
};
