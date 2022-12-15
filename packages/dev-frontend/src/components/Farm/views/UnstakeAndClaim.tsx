import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useKumo } from "../../../hooks/KumoContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useFarmView } from "../context/FarmViewContext";

const transactionId = "farm-unstake-and-claim";

export const UnstakeAndClaim: React.FC = () => {
  const { dispatchEvent } = useFarmView();

  const {
    kumo: { send: kumo }
  } = useKumo();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={kumo.exitLiquidityMining.bind(kumo)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button variant="outline" sx={{ mt: 3, width: "100%" }}>
        Unstake and claim reward
      </Button>
    </Transaction>
  );
};
