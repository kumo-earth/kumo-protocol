import React from "react";
import { Decimal, UserTrove, StabilityDeposit, Percent } from "@kumodao/lib-base";

import { Flex, Box, Card, Heading, Divider } from "theme-ui";

type StakingTypeCardProps = {
  vault?: {
    type: string;
    collateralRatio: Decimal;
    stabilityStatus: Boolean;
    usersTroves: UserTrove[];
    stabilityDeposit: StabilityDeposit;
  };
  handleViewStakeDeposit: () => void;
};

export const StakingTypeCard: React.FC<StakingTypeCardProps> = ({
  vault,
  handleViewStakeDeposit
}) => {
  const divdideVal = vault?.stabilityDeposit?.currentKUSD.div(vault?.stabilityDeposit?.currentKUSD);

  const aprRatio = divdideVal ? new Percent(divdideVal) : new Percent(Decimal.ZERO);

  return (
    <Card
      variant="base"
      onClick={handleViewStakeDeposit}
    >
      <Heading
        sx={{
          height: "100px !important",
        }}
        as="h2"
      >
        {vault?.type?.toUpperCase()} Stability Pool Staking
      </Heading>

      <Box sx={{ p: 4 }}>
        <Flex sx={{ justifyContent: "space-between", alignItems: "center", mt: 4 }}>
          <Heading as="h6">APR</Heading>
          <Heading as="h6">Total KUSD In Pool</Heading>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2 }}>
          <Heading as="h2">
            {aprRatio.toString(1) === "∞" ? Decimal.ZERO.prettify() : aprRatio.prettify()}
          </Heading>
          <Heading as="h2">{vault?.stabilityDeposit?.currentKUSD.shorten()}</Heading>
        </Flex>
        <Divider />
        <Flex sx={{ justifyContent: "space-between", mt: 4 }}>
          <Heading as="h4">Liquidation Gain APR</Heading>
          <Heading as="h4">-</Heading>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2, mb: 4 }}>
          <Heading as="h4">KUMO APR</Heading>
          <Heading as="h4">
            {aprRatio.toString(1) === "∞" ? Decimal.ZERO.prettify() : aprRatio.prettify()}
          </Heading>
        </Flex>
        <Divider />
        <Flex sx={{ justifyContent: "space-between", mt: 2 }}>
          <Heading as="h4">YOUR STAKED KUSD</Heading>
          <Heading as="h4">{vault?.stabilityDeposit?.currentKUSD.shorten()}</Heading>
        </Flex>
      </Box>
    </Card>
  );
};
