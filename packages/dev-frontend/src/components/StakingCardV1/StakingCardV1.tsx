import React from "react";
import { Decimal, UserTrove, StabilityDeposit, Percent } from "@kumodao/lib-base";

import { Flex, Box, Card, Button, Heading, Text, Paragraph } from "theme-ui";

type StakingCardV1Props = {
  vault?: {
    asset: string;
    stabilityStatus: Boolean;
    usersTroves: UserTrove[];
    stabilityDeposit: StabilityDeposit;
  };
  handleViewStakeDeposit: () => void;
};

export const StakingCardV1: React.FC<StakingCardV1Props> = ({ vault, handleViewStakeDeposit }) => {
  const divdideVal = vault?.stabilityDeposit?.currentKUSD.div(vault?.stabilityDeposit?.currentKUSD);

  const aprRatio = divdideVal ? new Percent(divdideVal) : new Percent(Decimal.ZERO);

  return (
    <Card
      sx={{
        maxWidth: 450,
        maxHeight: 390
      }}
      variant="base"
    >
      <Box sx={{ p: 4 }}>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Text as="p" variant="small">
           KUMO REWARD APR
          </Text>
          <Text as="p" variant="small">
            LIQUIDATION BONUS
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 1 }}>
          <Text as="p" variant="xlarge">0%</Text>
          <Text as="p" variant="xlarge">0%</Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 4 }}>
          <Text as="p" variant="normalBold">TOTAL DEPOSITED KUSD</Text>
          <Text as="p" variant="normalBold">0.00</Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2 }}>
          <Text as="p" variant="normalBold">YOUR DEPOSITED KUSD</Text>
          <Text as="p" variant="normalBold">0.00</Text>
        </Flex>
        <Flex sx={{ justifyContent: "center", pt: 3 }}>
          <Button variant="layout.actions" sx={{ width: "122px" }} onClick={handleViewStakeDeposit}>
            STAKE
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
