import React from "react";
import { Flex, Box, Card, Heading, Divider, Paragraph } from "theme-ui";
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { RiskyTroves } from "../RiskyTroves";

const data01 = [
  { name: "Group A", value: 400 },
  { name: "Group B", value: 300 },
  { name: "Group C", value: 300 },
  { name: "Group D", value: 200 },
  { name: "Group E", value: 278 },
  { name: "Group F", value: 189 }
];

const data02 = [
  { name: "Group A", value: 2400 },
  { name: "Group B", value: 4567 },
  { name: "Group C", value: 1398 },
  { name: "Group D", value: 9800 },
  { name: "Group E", value: 3908 },
  { name: "Group F", value: 4800 }
];

export const StatsRiskyTroves: React.FC = () => {
  return (
    <Box sx={{ my: 6, mt: 5, height: "90%" }}>
      <RiskyTroves pageSize={1} />
    </Box>
  );
};
