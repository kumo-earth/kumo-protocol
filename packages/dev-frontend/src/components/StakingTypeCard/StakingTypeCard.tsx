import React from "react";
import { Decimal, UserTrove, StabilityDeposit, Percent, Vault } from "@kumodao/lib-base";

import { Flex, Box, Card, Heading, Divider, Text } from "theme-ui";

type StakingTypeCardProps = {
  vault: Vault;
  handleViewStakeDeposit: () => void;
};

export const StakingTypeCard: React.FC<StakingTypeCardProps> = ({
  vault,
  handleViewStakeDeposit
}) => {
  const divdideVal = vault?.stabilityDeposit?.currentKUSD.div(vault?.stabilityDeposit?.currentKUSD);

  const aprRatio = divdideVal ? new Percent(divdideVal) : new Percent(Decimal.ZERO);

  return (
    <Card variant="StabilityPoolStakingCard" onClick={handleViewStakeDeposit}>
      <Heading
        // sx={{
        //   height: "100px !important"
        // }}
        as="h2"
      >
        {vault?.asset?.toUpperCase()} Stability Pool Staking
      </Heading>

      <Box sx={{ p: 4 }}>
        <Flex sx={{ justifyContent: "space-between", alignItems: "center", mt: 3 }}>
          <Text as="p" variant="small">
            APR
          </Text>
          <Text as="p" variant="small">
            Total KUSD In Pool
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2 }}>
          <Text as="p" variant="large">
            18%
          </Text>
          <Text as="p" variant="large">
            {vault?.stabilityDeposit.currentKUSD.isZero ? 0 : vault?.stabilityDeposit?.currentKUSD.shorten()}
          </Text>
        </Flex>
        <Divider color="muted" />
        <Flex sx={{ justifyContent: "space-between", mt: 4 }}>
          <Text as="p" variant="normalBold">
            Liquidation Gain APR
          </Text>
          <Text as="p" variant="normalBold">
            10%
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2, mb: 4 }}>
          <Text as="p" variant="normalBold">
            KUMO APR
          </Text>
          <Text as="p" variant="normalBold">
            8%
          </Text>
        </Flex>
        <Divider color="muted" />
        <Flex sx={{ justifyContent: "space-between", mt: 2 }}>
          <Text as="p" variant="normalBold">
            YOUR STAKED KUSD
          </Text>
          <Text as="p" variant="normalBold">
            {vault?.stabilityDeposit?.currentKUSD.shorten()}
          </Text>
        </Flex>
      </Box>
    </Card>
  );
};
