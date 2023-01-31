import React from "react";
import { Flex, Box, Card, Text, Heading, Divider, Paragraph } from "theme-ui";
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer } from "recharts";

const data01 = [
  { name: "BCT", value: 100 },
  { name: "MCO2", value: 300 }
];

const data02 = [
  { name: "BCT", value: 2400 },
  { name: "MCO2", value: 4567 }
];

type StatsPieChartProps = {
  title: string
}

export const StatsPieChart: React.FC<StatsPieChartProps> = ({ title }) => {
  return (
    <Card variant="base">
      <Box sx={{ px: 4, py: 3 }}>
        <Text as="p" sx={{ textAlign: "center", fontWeight: "bold" }}>
          { title }
        </Text>
        <Flex sx={{ justifyContent: "center", mx: 2, mt: 3, height: 180 }}>
          <ResponsiveContainer width="100%">
            <PieChart style={{ innerWidth: "100%", innerHeight: "100%" }}>
              <Pie
                dataKey="value"
                isAnimationActive={false}
                data={data01}
                cx="50%"
                cy="50%"
                outerRadius={70}
                fill="#8884d8"
                label={label => `${label?.name} ${label?.value}`}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Flex>
      </Box>
    </Card>
  );
};
