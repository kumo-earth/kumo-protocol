import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingLiquidityMiningKUMOReward }: LiquityStoreState) => ({
  remainingLiquidityMiningKUMOReward
});

export const RemainingKUMO: React.FC = () => {
  const { remainingLiquidityMiningKUMOReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningKUMOReward.prettify(0)} KUMO remaining
    </Flex>
  );
};
