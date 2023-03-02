import React from "react";
import { Flex, Box, Card, Text } from "theme-ui";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { Decimal } from "@kumodao/lib-base";

type StatsPieChartProps = {
  title: string;
  data: { name: string; symbol: string, value: number }[];
};

export const StatsPieChart: React.FC<StatsPieChartProps> = ({ title, data }) => {
  return (
    <Card variant="base">
      <Box sx={{ px: 4, py: 3 }}>
        <Text as="p" sx={{ textAlign: "center", fontWeight: "bold" }}>
          {title}
        </Text>
        <Flex sx={{ justifyContent: "center", mx: 2, mt: 3, height: 250 }}>
          <ResponsiveContainer width="100%" minWidth='500px' >
            <PieChart style={{ innerWidth: "100%", innerHeight: "100%" }}>
              <Pie
                dataKey="value"
                isAnimationActive={false}
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={70}
                fill="#8884d8"
                label={label => {
                  if(label?.symbol === "KUSD"){
                    return `${Decimal.from(label?.value).prettify(0)} KUSD`
                  } else if(label?.symbol === "$")
                  return `$ ${Decimal.from(label?.value).prettify(0)}`
                }}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Flex>
      </Box>
    </Card>
  );
};
