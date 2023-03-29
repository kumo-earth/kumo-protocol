import React from "react";
import { Decimal } from "@kumodao/lib-base";

import { Flex, Box, Card, Button, Text } from "theme-ui";

type StakingCardV1Props = {
  totalKUSD: Decimal;
  userKUSD: Decimal;
  handleViewStakeDeposit: () => void;
};

export const StakingCardV1: React.FC<StakingCardV1Props> = ({
  totalKUSD,
  userKUSD,
  handleViewStakeDeposit
}) => {

  return (
    <Card
      sx={{
        maxHeight: 390
      }}
      variant="base"
    >
      <Box sx={{ px: 5, pt: 4, pb: 3 }}>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Text as="p" variant="small">
            KUMO REWARD APR
          </Text>
          <Text as="p" variant="small">
            LIQUIDATION BONUS
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 1, flexWrap: 'wrap' }}>
          <Text as="p" variant="xlarge">
            8%
          </Text>
          <Text as="p" variant="xlarge">
            10%
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 4, flexWrap: 'wrap' }}>
          <Text as="p" variant="normalBold">
            TOTAL DEPOSITED KUSD
          </Text>
          <Text as="p" variant="normalBold">
            {totalKUSD.prettify(0)}
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2, flexWrap: 'wrap' }}>
          <Text as="p" variant="normalBold">
            YOUR DEPOSITED KUSD
          </Text>
          <Text as="p" variant="normalBold">
            {userKUSD.prettify(0)}
          </Text>
        </Flex>
        <Flex variant="layout.actions">
          <Button sx={{ mt: 3, mb: 2 }} onClick={handleViewStakeDeposit}>
            STAKE
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
