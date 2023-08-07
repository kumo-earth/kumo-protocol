import React, { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button, Flex } from "theme-ui";

import {
  Decimal,
  Decimalish,
  KumoStoreState,
  StabilityDeposit,
  Vault
} from "@kumodao/lib-base";
import { KumoStoreUpdate, useKumoReducer, useKumoSelector } from "@kumodao/lib-react";

import { COIN } from "../../strings";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { StabilityDepositAction } from "./StabilityDepositAction";
import { useStabilityView } from "./context/StabilityViewContext";
import { validateStabilityDepositChange } from "./validation/validateStabilityDepositChange";

type StabilityDepositManagerState = {
  collateralType: string;
  originalDeposit: StabilityDeposit;
  editedKUSD: Decimal;
  changePending: boolean;
};
type StabilityDepositManagerAction =
  | KumoStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" }
  | { type: "setDeposit"; newValue: Decimalish };

const reduceWith =
  (action: StabilityDepositManagerAction) =>
    (state: StabilityDepositManagerState): StabilityDepositManagerState =>
      reduce(state, action);

const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (
  state: StabilityDepositManagerState,
  action: StabilityDepositManagerAction
): StabilityDepositManagerState => {

  const { originalDeposit, editedKUSD, changePending } = state;

  switch (action.type) {
    case "startChange": {
      console.log("changeStarted");
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setDeposit":
      return { ...state, editedKUSD: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedKUSD: originalDeposit.currentKUSD };

    case "updateStore": {
      const vault = action.stateChange.vaults?.find(vault => vault.asset === state.collateralType);
      const updatedStabilityDeposit = vault?.stabilityDeposit;
      if (!updatedStabilityDeposit) {
        return state;
      }
      const newState = { ...state, originalDeposit: updatedStabilityDeposit };

      const changeCommitted =
        !updatedStabilityDeposit.initialKUSD.eq(originalDeposit.initialKUSD) ||
        updatedStabilityDeposit.currentKUSD.gt(originalDeposit.currentKUSD) ||
        updatedStabilityDeposit.collateralGain.lt(originalDeposit.collateralGain) ||
        updatedStabilityDeposit.kumoReward.lt(originalDeposit.kumoReward);

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      return {
        ...newState,
        editedKUSD: updatedStabilityDeposit.apply(originalDeposit.whatChanged(editedKUSD))
      };
    }
  }
};

const transactionId = "stability-deposit";

const select = ({ vaults, kusdBalance }: KumoStoreState) => ({
  vaults,
  kusdBalance
});

export const StabilityDepositManager: React.FC = () => {
  const { collateralType } = useParams<{ collateralType: string }>();
  const { vaults, kusdBalance } = useKumoSelector(select);
  const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault();
  const { stabilityDeposit, trove, haveUndercollateralizedTroves } = vault;

  const validationContext = {
    trove,
    kusdBalance,
    haveUndercollateralizedTroves
  };

  const [{ originalDeposit, editedKUSD, changePending }, dispatch] = useKumoReducer(reduce, () => {
    return {
      collateralType,
      originalDeposit: stabilityDeposit,
      editedKUSD: stabilityDeposit?.currentKUSD,
      changePending: false
    };
  });

  const { dispatchEvent } = useStabilityView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CLOSE_MODAL_PRESSED");
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const [validChange, description] = validateStabilityDepositChange(
    collateralType,
    originalDeposit,
    editedKUSD,
    validationContext
  );

  const makingNewDeposit = originalDeposit.isEmpty;

  const myTransactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("DEPOSIT_CONFIRMED");
    }
  }, [myTransactionState.type, dispatch, dispatchEvent]);

  return (
    <StabilityDepositEditor
      originalDeposit={originalDeposit}
      editedKUSD={editedKUSD}
      changePending={changePending}
      dispatch={dispatch}
    >
      {description ??
        (makingNewDeposit ? (
          <ActionDescription>Enter the amount of {COIN} you'd like to deposit.</ActionDescription>
        ) : (
          <ActionDescription>Adjust the {COIN} amount to deposit or withdraw.</ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button variant="secondary" sx={{ m: 3 }} onClick={handleCancel}>
          CANCEL
        </Button>

        {validChange ? (
          <StabilityDepositAction
            transactionId={transactionId}
            change={validChange}
            asset={collateralType}
          >
            CONFIRM
          </StabilityDepositAction>
        ) : (
          <Button variant="primaryInActive" disabled sx={{ mb: 2 }}>CONFIRM</Button>
        )}
      </Flex>
    </StabilityDepositEditor>
  );
};
