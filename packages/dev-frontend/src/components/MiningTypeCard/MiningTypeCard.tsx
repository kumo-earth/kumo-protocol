import React from "react";
import { Flex, Box, Card, Heading, Text } from "theme-ui";

export const MiningTypeCard: React.FC = () => {
  return (
    <Card
      sx={{
        height: "max-content"
      }}
      variant="base"
    >
      <Heading
        sx={{
          height: "100px !important"
        }}
        as="h2"
      >
        KUSD-USDC
      </Heading>

      <Box sx={{ p: 4 }}>
        <Flex sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Text as="p" variant="small">APR</Text>
          <Text as="p" variant="small">Total KUSD In Pool</Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Text as="p" variant="normalBold">YOUR STAKED AMOUNT</Text>
          <Text as="p" variant="normalBold">0</Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 3 }}>
          <Text as="p" variant="normalBold">YOUR STAKED AMOUNT (USD)</Text>
          <Text as="p" variant="normalBold">0</Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Text as="p" variant="normalBold">POOL SHARE</Text>
          <Text as="p" variant="normalBold">0%</Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Text as="p" variant="normalBold">PENDING REWARDS</Text>
          <Text as="p" variant="normalBold">0 KUSD</Text>
        </Flex>
      </Box>
    </Card>
  );
};
