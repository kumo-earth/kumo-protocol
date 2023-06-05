import { parseInt } from "lodash";
import React from "react";
import { Flex, Grid } from "theme-ui";
import { StatsPieChart } from "../components/StatsPieChart/StatsPieChart";
import { StatsPriceTVLChart } from "../components/StatsPriceTVLChart/StatsPriceTVLChart";
import { StatsTVCard } from "../components/StatsTVCard/StatsTVCard";
import { useDashboard } from "../hooks/DashboardContext";
import { Decimal } from "@kumodao/lib-base";

export const ProtocolStats: React.FC = () => {
  const { systemTotalCollDebt, assetTotalCollDebt } = useDashboard();

  const getStatsTVCardData = (type: string, assetdata: { [key: string]: { assetCollateral: Decimal; assetDebt: Decimal; }; }) => {
    const keys = Object.keys(assetdata)
    switch (type) {
      case 'collateral': {
        const data = keys?.map(asset => {
          return { name: `${asset.toUpperCase()} Vault`, value: `${assetdata[asset].assetCollateral.prettify(0)} KUSD` }
        })
        return data;
      }
      case 'debt': {
        const data = keys?.map(asset => {
          return { name: `${asset.toUpperCase()} Vault`, value: `${assetdata[asset].assetDebt.prettify(0)} KUSD` }
        })
        return data
      }
      default:
        return [];
    }
  }

  const getStatsPieChartData = (type: string, assetdata: { [key: string]: { assetCollateral: Decimal; assetDebt: Decimal; }; }) => {
    const keys = Object.keys(assetdata)
    switch (type) {
      case 'collateral': {
        const data = keys?.map(asset => {
          return { name: `${asset.toUpperCase()}`, symbol: '$', value: parseInt(assetdata[asset].assetCollateral.toString()) }
        })
        return data;
      }

      case 'debt': {
        const data = keys?.map(asset => {
          return { name: `${asset.toUpperCase()}`, symbol: 'KUSD', value: parseInt(assetdata[asset].assetDebt.toString()) }
        })
        return data;
      }
      default:
        return [];
    }
  }

  return (
    <Flex sx={{ flexDirection: "column", my: 6 }}>
      {
        assetTotalCollDebt ?
          <>
            <Grid sx={{ gridGap: [2, 4], gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`, }}>
              <StatsTVCard
                title="Total Value Locked"
                totalValueLocked={systemTotalCollDebt.systemTotalCollateral}
                data={getStatsTVCardData('collateral', assetTotalCollDebt)}
                key={"1"}
              />
              <StatsTVCard
                title="Total KUSD Minted"
                totalValueLocked={systemTotalCollDebt.systemTotalDebt}
                data={getStatsTVCardData('debt', assetTotalCollDebt)}
                key={"2"}
              />
            </Grid>
            <Grid sx={{ mt: 8, gridGap: 4, gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`, }}>
              <StatsPieChart
                title="KUSD Collateralization"
                data={getStatsPieChartData('collateral', assetTotalCollDebt)}
                key={"1"}
              />
              <StatsPieChart
                title="KUSD Minted by Vault"
                data={getStatsPieChartData('debt', assetTotalCollDebt)}
                key={"2"}
              />
            </Grid>
          </>
          : null}
      <StatsPriceTVLChart />
    </Flex>
  );
};
