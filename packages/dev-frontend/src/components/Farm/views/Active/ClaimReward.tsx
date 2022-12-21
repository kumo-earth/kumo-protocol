import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useKumo } from "../../../../hooks/KumoContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { useFarmView } from "../../context/FarmViewContext";

const transactionId = "farm-claim-reward";

export const ClaimReward: React.FC = () => {
  const { dispatchEvent } = useFarmView();

  const {
    kumo: { send: kumo }
  } = useKumo();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("CLAIM_REWARD_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={kumo.withdrawKUMORewardFromLiquidityMining.bind(kumo)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button>Claim reward</Button>
    </Transaction>
  );
};
