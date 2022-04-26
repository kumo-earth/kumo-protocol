import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Flex } from "theme-ui";

import { Decimal, Decimalish, KumoStoreState } from "@liquity/lib-base";
import { KumoStoreUpdate, useKumoReducer, useKumoSelector } from "@liquity/lib-react";
import { useDashboard } from "../../hooks/DashboardContext";

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

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const StabilityDepositManager: React.FC = () => {
  const location = useLocation();
  const { vaults, depositKusd, handleDepositKusd, openStabilityDeposit } = useDashboard();
  const vaultType = vaults.find(vault => vault.type === getPathName(location)) || vaults[0];

  const [{ originalDeposit, editedKUSD, changePending }, dispatch] = useKumoReducer(reduce, () => {
    return {
      originalDeposit: vaultType.stabilityDeposit,
      editedKUSD: vaultType.stabilityDeposit.currentKUSD,
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
      if (validChange?.depositKUSD) {
        handleDepositKusd(validChange?.depositKUSD, undefined, false);
      } else if (validChange?.withdrawAllKUSD) {
        handleDepositKusd(undefined, Decimal.ZERO, true);
      } else if (validChange?.withdrawKUSD) {
        handleDepositKusd(undefined, validChange?.withdrawKUSD, false);
      }
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      if (depositKusd.depositLUSD) {
        openStabilityDeposit(
          getPathName(location),
          vaultType.stabilityDeposit.currentKUSD.add(depositKusd.depositLUSD)
        );
      }
      if (depositKusd.withdrawAllLUSD) {
        openStabilityDeposit(getPathName(location), Decimal.ZERO);
      } else if (depositKusd.withdrawLUSD) {
        openStabilityDeposit(
          getPathName(location),
          vaultType.stabilityDeposit.currentKUSD.sub(depositKusd?.withdrawLUSD)
        );
      }
      handleDepositKusd(undefined, undefined, false);
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
        <Button
          sx={{
            backgroundColor: "rgb(152, 80, 90)",
            boxShadow:
              "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
            border: "none",
            color: "white"
          }}
          variant="cancel"
          onClick={handleCancel}
        >
          Cancel
        </Button>

        {validChange ? (
          <StabilityDepositAction transactionId={transactionId} change={validChange}>
            Confirm
          </StabilityDepositAction>
        ) : (
          <Button
            sx={{
              backgroundColor: "rgb(152, 80, 90)",
              boxShadow:
                "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
              border: "none",
              color: "white"
            }}
            disabled
          >
            Confirm
          </Button>
        )}
      </Flex>
    </StabilityDepositEditor>
  );
};
