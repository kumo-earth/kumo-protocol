import React from "react";
import { Vault } from "@kumodao/lib-base";

import { Flex, Box, Card, Heading, Divider, Text } from "theme-ui";

type StakingTypeCardProps = {
  vault: Vault;
  handleViewStakeDeposit: () => void;
};

export const StakingTypeCard: React.FC<StakingTypeCardProps> = ({
  vault,
  handleViewStakeDeposit
}) => {

  return (
    <Card variant="StabilityPoolStakingCard" onClick={handleViewStakeDeposit}>
      <Heading
        as="h2"
      >
        {vault?.asset?.toUpperCase()} Stability Pool Staking <Text variant="assetName">({vault.assetName})</Text>
      </Heading>

      <Box sx={{ p: 4 }}>
        <Flex sx={{ justifyContent: "space-between", alignItems: "center", mt: 3, flexWrap: 'wrap' }}>
          <Text as="p" variant="small">
            APR
          </Text>
          <Text as="p" variant="small">
            Total KUSD In Pool
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2, flexWrap: 'wrap' }}>
          <Text as="p" variant="large">
            18%
          </Text>
          <Text as="p" variant="large">
            {vault?.kusdInStabilityPool?.isZero ? 0 : vault?.kusdInStabilityPool.prettify(0)}
          </Text>
        </Flex>
        <Divider color="muted" />
        <Flex sx={{ justifyContent: "space-between", mt: 4, flexWrap: 'wrap' }}>
          <Text as="p" variant="normalBold">
            Liquidation Gain APR
          </Text>
          <Text as="p" variant="normalBold">
            10%
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mt: 2, mb: 4, flexWrap: 'wrap' }}>
          <Text as="p" variant="normalBold">
            KUMO APR
          </Text>
          <Text as="p" variant="normalBold">
            8%
          </Text>
        </Flex>
        <Divider color="muted" />
        <Flex sx={{ justifyContent: "space-between", mt: 2, flexWrap: 'wrap' }}>
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
