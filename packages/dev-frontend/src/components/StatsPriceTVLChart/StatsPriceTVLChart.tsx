import React, { useEffect, useState } from "react";
import { Flex, Box, Card, Text, Select, Heading, Divider, Paragraph } from "theme-ui";
import {
  PieChart,
  Pie,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

const data01 = [
  {
    name: "6th Oct 2022",
    price: 0.281
  },
  {
    name: "12th Oct 2022",
    price: 0.391
  },
  {
    name: "18th Oct 2022",
    price: 0.571
  },
  {
    name: "24th Oct 2022",
    price: 0.431
  },
  {
    name: "30th Oct 2022",
    price: 0.221
  },
  {
    name: "6th Nov 2022",
    price: 0.181
  }
];

const data = [
  {
    name: "6th Oct 2022",
    CTX: 400000,
    CTY: 400500
  },
  {
    name: "12th Oct 2022",
    CTX: 705070,
    CTY: 605000,
  },
  {
    name: "18th Oct 2022",
    CTX: 200300,
    CTY: 205000
  },
  {
    name: "24th Oct 2022",
    CTX: 500300,
    CTY: 700300
  },
  {
    name: "30th Oct 2022",
    CTX: 300300,
    CTY: 500300
  },
  {
    name: "6th Nov 2022",
    CTX: 800300,
    CTY: 400300
  }
];

export const StatsPriceTVLChart: React.FC = () => {
  return (
    <Card variant="base" sx={{ mt: 8 }}>
      <Box sx={{ px: 4, py: 3 }}>
        <Flex sx={{ alignItems: "center" }}>
          <Text sx={{ fontWeight: "bold" }}>Show Data from Last: </Text>
          <Select
            defaultValue="Months"
            sx={{
              ml: 2,
              p: 1,
              border: "none",
              borderRadius: 6,
              minWidth: 90,
              maxWidth: "max-content",
              backgroundColor: "#efa7c3",
              ":focus-visible": { outline: "none" }
            }}
          >
            <option>All</option>
            <option>Week</option>
            <option>Months</option>
            <option>Years</option>
          </Select>
        </Flex>
        <Flex sx={{ flexDirection: "column", mx: 2, mt: 6 }}>
          <Flex sx={{ flexDirection: "column", height: "270px" }}>
            <Text as="p" sx={{ mb: 3, fontWeight: "bold", textAlign: "center" }}>
              KUSD PRICE
            </Text>
            <ResponsiveContainer width="95%">
              <LineChart data={data01} style={{ innerWidth: "100%" }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </Flex>
          <Flex sx={{ flexDirection: "column", height: "270px", mt: 6 }}>
            <Text as="p" sx={{ fontWeight: "bold", textAlign: "center", mb: 2 }}>
              KUMO Protocol TVL
            </Text>
            <ResponsiveContainer width="95%">
              <AreaChart
                data={data}
                margin={{
                  top: 10,
                  right: 30,
                  left: 0,
                  bottom: 0
                }}
                style={{ innerWidth: "100%", innerHeight: "100%" }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="CTX" stackId="1" stroke="#8884d8" fill="#8884d8" />
                <Area type="monotone" dataKey="CTY" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
