import React from "react";

import { Decimal, StabilityDeposit, StabilityDepositChange } from "@liquity/lib-base";

import { COIN, GT } from "../../strings";
import { ActionDescription, Amount } from "../ActionDescription";

type StabilityActionDescriptionProps = {
  originalDeposit: StabilityDeposit;
  change: StabilityDepositChange<Decimal>;
};

export const StabilityActionDescription: React.FC<StabilityActionDescriptionProps> = ({
  originalDeposit,
  change
}) => {
  const collateralGain = originalDeposit.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const kumoReward = originalDeposit.kumoReward.nonZero?.prettify().concat(" ", GT);

  return (
    <ActionDescription>
      {change.depositKUSD ? (
        <>
          You are depositing{" "}
          <Amount>
            {change.depositKUSD.prettify()} {COIN}
          </Amount>{" "}
          in the Stability Pool
        </>
      ) : (
        <>
          You are withdrawing{" "}
          <Amount>
            {change.withdrawKUSD.prettify()} {COIN}
          </Amount>{" "}
          to your wallet
        </>
      )}
      {(collateralGain || kumoReward) && (
        <>
          {" "}
          and claiming at least{" "}
          {collateralGain && kumoReward ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{kumoReward}</Amount>
            </>
          ) : (
            <Amount>{collateralGain ?? kumoReward}</Amount>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};
