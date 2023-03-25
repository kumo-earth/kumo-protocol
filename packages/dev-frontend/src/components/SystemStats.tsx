import React from "react";
import { Card, Heading, Box } from "theme-ui";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useDashboard } from "../hooks/DashboardContext";
import { Statistic } from "./Statistic";
import { Icon } from "../components/Icon";


const selectBalances = ({ vaults, kusdBalance, kumoBalance }: KumoStoreState) => ({
  vaults,
  kusdBalance,
  kumoBalance
});

const Balances: React.FC = () => {
  const { kumoBalance } = useKumoSelector(selectBalances);
  const { totalTroveCollDebt } = useDashboard();



  return (
    <Box sx={{ px: 5, mt: 5 }}>
      <Heading as="h3" sx={{ my: 3 }}>My Portfolio</Heading>
      <Statistic name={"MY TOTAL COLLATERAL"}>{`$ ${totalTroveCollDebt.totalTroveColl.prettify(0)}`}</Statistic>
      <Statistic name={"MY MINTED KUSD"}>{`$ ${totalTroveCollDebt.totalTroveDebt.prettify(0)}`}</Statistic>
      <Statistic name={"MY TOTAL CARBON CREDITS"}>{`${totalTroveCollDebt.troveTotalCarbonCredits.prettify(0)}`}</Statistic>
      <Statistic name={"KUMO BALANCE"}>{`${kumoBalance.prettify(0)}`}</Statistic>
    </Box>
  );
};



type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
  onClose: (event: React.MouseEvent<HTMLElement>) => void;
};

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances, onClose }) => {
  const { totalCollDebt } = useDashboard();

  return (
    <Card variant="systemStatsCard">
      <Heading as={"h2"}>Statistics
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={e => onClose(e)}
        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      <Box sx={{ px: 5, mt: 3 }}>
        <Heading as="h3" sx={{ my: 3 }}>
          KUMO Protocol
        </Heading>
        <Statistic name={"TOTAL COLLATERAL"}>{`$${totalCollDebt.totalColl.prettify(0)}`}</Statistic>
        <Statistic name={"TOTAL MINTED KUSD"}>{`$${totalCollDebt.totalDebt.prettify(0)}`}</Statistic>
        <Statistic name={"TOTAL CARBON CREDITS"}>{totalCollDebt.totalCarbonCredits.prettify(0)}</Statistic>
      </Box>
      {showBalances && <Balances />}
      { }
    </Card>
  );
};
