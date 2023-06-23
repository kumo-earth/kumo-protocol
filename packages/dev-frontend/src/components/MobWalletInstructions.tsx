import React from "react";
import { Card, Heading, Box } from "theme-ui";
import { useDashboard } from "../hooks/DashboardContext";
import { Statistic } from "./Statistic";

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
};

export const MobWalletInstructons: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const { systemTotalCollDebt } = useDashboard();

  return (
    <Card variant="walletInstruction">
      <Heading as={"h2"}>Statistics</Heading>
      <Box sx={{ px: 5, mt: 3 }}>
        <Heading as="h3" sx={{ my: 3 }}>
          KUMO Protocol
        </Heading>
        <Statistic name={"TOTAL COLLATERAL"}>{`$${ systemTotalCollDebt.systemTotalCollateral.prettify(0)}`}</Statistic>
        <Statistic name={"TOTAL MINTED KUSD"}>{`$${systemTotalCollDebt.systemTotalDebt.prettify(0)}`}</Statistic>
        <Statistic name={"TOTAL CARBON CREDITS"}>{systemTotalCollDebt.systemTotalCarbonCredits.prettify(0)}</Statistic>
      </Box>
    </Card>
  );
};
