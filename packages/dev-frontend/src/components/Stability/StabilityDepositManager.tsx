import React, { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button, Flex } from "theme-ui";

import { ASSET_TOKENS, Decimal, Decimalish, KumoStoreState, StabilityDeposit } from "@kumodao/lib-base";
import { KumoStoreUpdate, useKumoReducer, useKumoSelector } from "@kumodao/lib-react";

import { COIN } from "../../strings";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { StabilityDepositAction } from "./StabilityDepositAction";
import { useStabilityView } from "./context/StabilityViewContext";
import {
  selectForStabilityDepositChangeValidation,
  validateStabilityDepositChange
} from "./validation/validateStabilityDepositChange";

const init = ({ stabilityDeposit }: KumoStoreState) => {
  return {
    originalDeposit: stabilityDeposit,
    editedKUSD: stabilityDeposit.currentKUSD,
    changePending: false
  };
};

type StabilityDepositManagerState = ReturnType<typeof init>;
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
  // console.log(state);
  // console.log(action);

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
      const {
        stateChange: { stabilityDeposit: updatedDeposit }
      } = action;

      if (!updatedDeposit) {
        return state;
      }

      const newState = { ...state, originalDeposit: updatedDeposit };

      const changeCommitted =
        !updatedDeposit.initialKUSD.eq(originalDeposit.initialKUSD) ||
        updatedDeposit.currentKUSD.gt(originalDeposit.currentKUSD) ||
        updatedDeposit.collateralGain.lt(originalDeposit.collateralGain) ||
        updatedDeposit.kumoReward.lt(originalDeposit.kumoReward);

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      return {
        ...newState,
        editedKUSD: updatedDeposit.apply(originalDeposit.whatChanged(editedKUSD))
      };
    }
  }
};

const transactionId = "stability-deposit";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const StabilityDepositManager: React.FC = () => {
  const { collateralType } = useParams<{ collateralType: string }>();
  const { vaults } = useKumoSelector(select);
  const vault = vaults.find(vault => vault.asset === collateralType);
  const stabilityDeposit: StabilityDeposit = vault?.stabilityDeposit && vault.stabilityDeposit;
  const [{ originalDeposit, editedKUSD, changePending }, dispatch] = useKumoReducer(reduce, () => {
    return {
      originalDeposit: stabilityDeposit,
      editedKUSD: stabilityDeposit?.currentKUSD,
      changePending: false
    };
  });


  const validationContext = useKumoSelector(selectForStabilityDepositChangeValidation);
  const { dispatchEvent } = useStabilityView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const [validChange, description] = validateStabilityDepositChange(
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
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>

        {validChange ? (
          <StabilityDepositAction transactionId={transactionId} change={validChange} asset={collateralType}>
            Confirm
          </StabilityDepositAction>
        ) : (
          <Button>Confirm</Button>
        )}
      </Flex>
    </StabilityDepositEditor>
  );
};
