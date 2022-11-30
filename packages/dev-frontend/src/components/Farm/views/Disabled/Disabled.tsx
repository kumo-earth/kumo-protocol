import React from "react";
import { Card, Heading, Box, Flex } from "theme-ui";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { InfoMessage } from "../../../InfoMessage";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { RemainingKUMO } from "../RemainingKUMO";
import { StaticRow } from "../../../Trove/Editor";
import { GT, LP } from "../../../../strings";

const selector = ({ liquidityMiningStake, liquidityMiningKUMOReward }: KumoStoreState) => ({
  liquidityMiningStake,
  liquidityMiningKUMOReward
});

export const Disabled: React.FC = () => {
  const { liquidityMiningStake, liquidityMiningKUMOReward } = useKumoSelector(selector);
  const hasStake = !liquidityMiningStake.isZero;

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        <Flex sx={{ justifyContent: "flex-end" }}>
          {/* <RemainingKUMO /> */}
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Liquidity farming period has finished">
          <Flex>There are no more KUMO rewards left to farm</Flex>
        </InfoMessage>
        {hasStake && (
          <>
            <Box sx={{ border: 1, pt: 3, borderRadius: 3 }}>
              <StaticRow
                label="Stake"
                inputId="farm-deposit"
                amount={liquidityMiningStake.prettify(0)}
                unit={LP}
              />
              <StaticRow
                label="Reward"
                inputId="farm-reward"
                amount={liquidityMiningKUMOReward.prettify(0)}
                color={liquidityMiningKUMOReward.nonZero && "success"}
                unit={GT}
              />
            </Box>
            <UnstakeAndClaim />
          </>
        )}
      </Box>
    </Card>
  );
};
