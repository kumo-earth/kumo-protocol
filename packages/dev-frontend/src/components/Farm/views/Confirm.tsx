import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@kumodao/lib-base";
import { useKumo } from "../../../hooks/KumoContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useValidationState } from "../context/useValidationState";
import { useFarmView } from "../context/FarmViewContext";

type ConfirmProps = {
  amount: Decimal;
};

const transactionId = "farm-confirm";

export const Confirm: React.FC<ConfirmProps> = ({ amount }) => {
  const { dispatchEvent } = useFarmView();
  const {
    kumo: { send: kumo }
  } = useKumo();

  const transactionState = useMyTransactionState(transactionId);
  const { isValid, isWithdrawing, amountChanged } = useValidationState(amount);

  const transactionAction = isWithdrawing
    ? kumo.unstakeUniTokens.bind(kumo, amountChanged)
    : kumo.stakeUniTokens.bind(kumo, amountChanged);

  const shouldDisable = amountChanged.isZero || !isValid;

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={transactionAction}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button disabled={shouldDisable}>Confirm</Button>
    </Transaction>
  );
};
