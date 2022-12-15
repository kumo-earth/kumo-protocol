import React from "react";
import { Flex, Box, Card, Heading, Paragraph } from "theme-ui";

export const MiningTypeCard: React.FC = ({}) => {
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
        VSTA-ETH
      </Heading>

      <Box sx={{ p: 4 }}>
        <Flex sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Heading as="h6">APR</Heading>
          <Heading as="h6">Total KUSD In Pool</Heading>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Paragraph variant="mediumBold">YOUR STAKED AMOUNT</Paragraph>
          <Paragraph variant="mediumBold">0</Paragraph>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 3 }}>
          <Paragraph variant="mediumBold">YOUR STAKED AMOUNT (USD)</Paragraph>
          <Paragraph variant="mediumBold">0</Paragraph>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Paragraph variant="mediumBold">POOL SHARE</Paragraph>
          <Paragraph variant="mediumBold">0%</Paragraph>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Paragraph variant="mediumBold">PENDING REWARDS</Paragraph>
          <Paragraph variant="mediumBold">0 KUSD</Paragraph>
        </Flex>
      </Box>
    </Card>
  );
};
