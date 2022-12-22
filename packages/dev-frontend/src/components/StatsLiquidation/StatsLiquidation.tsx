import React from "react";
import { Flex, Box, Card, Text, Select } from "theme-ui";
import { DashboadHeaderItem } from "../DashboardHeaderItem";
import { RiskyTroves } from "../RiskyTroves";

export const StatsLiquidation: React.FC = () => {
  return (
    <Box sx={{ py: 6 }}>
      <Flex sx={{ alignItems: "center" }}>
        <Text>Show Data from Last: </Text>
        <Select defaultValue="Months" sx={{ ml: 2 }}>
          <option>All</option>
          <option>Week</option>
          <option>Months</option>
          <option>Years</option>
        </Select>
      </Flex>
      <Flex sx={{ height: "max-content", mt: 4 }}>
        <DashboadHeaderItem title={"TOTAL DEBT LIQUIDATED"} value={`${0.0}`} />
        <DashboadHeaderItem title={"TOTAL DEBT LIQUIDATED"} value={`${0} ETH`} />
      </Flex>
      <Card variant="base" my={6}>
        <Box sx={{ px: 4, py: 3 }}>
          <RiskyTroves pageSize={1} />
        </Box>
      </Card>
    </Box>
  );
};
