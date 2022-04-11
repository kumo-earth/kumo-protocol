import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingStabilityPoolKUMOReward }: LiquityStoreState) => ({
  remainingStabilityPoolKUMOReward
});

export const RemainingKUMO: React.FC = () => {
  const { remainingStabilityPoolKUMOReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolKUMOReward.prettify(0)} KUMO remaining
    </Flex>
  );
};
