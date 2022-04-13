import { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Flex, Button } from "theme-ui";

import { KumoStoreState, Decimal, Trove, Decimalish, KUSD_MINIMUM_DEBT } from "@liquity/lib-base";

import { KumoStoreUpdate, useKumoReducer, useKumoSelector } from "@liquity/lib-react";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";

import {
  selectForTroveChangeValidation,
  validateTroveChange
} from "./validation/validateTroveChange";

const init = ({ trove }: KumoStoreState) => ({
  original: trove,
  edited: new Trove(trove.collateral, trove.debt),
  changePending: false,
  debtDirty: false,
  addedMinimumDebt: false
});

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

type TroveManagerState = ReturnType<typeof init>;
type TroveManagerAction =
  | KumoStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" | "addMinimumDebt" | "removeMinimumDebt" }
  | { type: "setCollateral" | "setDebt"; newValue: Decimalish };

const reduceWith = (action: TroveManagerAction) => (state: TroveManagerState): TroveManagerState =>
  reduce(state, action);

const addMinimumDebt = reduceWith({ type: "addMinimumDebt" });
const removeMinimumDebt = reduceWith({ type: "removeMinimumDebt" });
const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state: TroveManagerState, action: TroveManagerAction): TroveManagerState => {
  // console.log(state);
  // console.log(action);

  const { original, edited, changePending, debtDirty, addedMinimumDebt } = state;

  switch (action.type) {
    case "startChange": {
      console.log("starting change");
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setCollateral": {
      const newCollateral = Decimal.from(action.newValue);

      const newState = {
        ...state,
        edited: edited.setCollateral(newCollateral)
      };

      if (!debtDirty) {
        if (edited.isEmpty && newCollateral.nonZero) {
          return addMinimumDebt(newState);
        }
        if (addedMinimumDebt && newCollateral.isZero) {
          return removeMinimumDebt(newState);
        }
      }

      return newState;
    }

    case "setDebt":
      return {
        ...state,
        edited: edited.setDebt(action.newValue),
        debtDirty: true
      };

    case "addMinimumDebt":
      return {
        ...state,
        edited: edited.setDebt(KUSD_MINIMUM_DEBT),
        addedMinimumDebt: true
      };

    case "removeMinimumDebt":
      return {
        ...state,
        edited: edited.setDebt(0),
        addedMinimumDebt: false
      };

    case "revert":
      return {
        ...state,
        edited: new Trove(original.collateral, original.debt),
        debtDirty: false,
        addedMinimumDebt: false
      };

    case "updateStore": {
      const {
        newState: { trove },
        stateChange: { troveBeforeRedistribution: changeCommitted }
      } = action;

      const newState = {
        ...state,
        original: trove
      };

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      const change = original.whatChanged(edited, 0);

      if (
        (change?.type === "creation" && !trove.isEmpty) ||
        (change?.type === "closure" && trove.isEmpty)
      ) {
        return revert(newState);
      }

      return { ...newState, edited: trove.apply(change, 0) };
    }
  }
};

const feeFrom = (original: Trove, edited: Trove, borrowingRate: Decimal): Decimal => {
  const change = original.whatChanged(edited, borrowingRate);

  if (change && change.type !== "invalidCreation" && change.params.borrowKUSD) {
    return change.params.borrowKUSD.mul(borrowingRate);
  } else {
    return Decimal.ZERO;
  }
};

const select = (state: KumoStoreState) => ({
  fees: state.fees,
  validationContext: selectForTroveChangeValidation(state)
});

const transactionIdPrefix = "trove-";
const transactionIdMatcher = new RegExp(`^${transactionIdPrefix}`);

type TroveManagerProps = {
  collateral?: Decimalish;
  debt?: Decimalish;
};

export const TroveManager: React.FC<TroveManagerProps> = ({ collateral, debt }) => {
  const [{ original, edited, changePending }, dispatch] = useKumoReducer(reduce, init);
  const { fees, validationContext } = useKumoSelector(select);
  const location = useLocation();

  useEffect(() => {
    if (collateral !== undefined) {
      dispatch({ type: "setCollateral", newValue: collateral });
    }
    if (debt !== undefined) {
      dispatch({ type: "setDebt", newValue: debt });
    }
  }, [collateral, debt, dispatch]);

  const borrowingRate = fees.borrowingRate();
  const maxBorrowingRate = borrowingRate.add(0.005); // TODO slippage tolerance

  const [validChange, description] = validateTroveChange(
    original,
    edited,
    borrowingRate,
    validationContext
  );

  const { dispatchEvent } = useTroveView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);

  const openingNewTrove = original.isEmpty;

  const myTransactionState = useMyTransactionState(transactionIdMatcher);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      if (myTransactionState.id === `${transactionIdPrefix}closure`) {
        dispatchEvent("TROVE_CLOSED");
      } else {
        dispatchEvent("TROVE_ADJUSTED");
      }
    }
  }, [myTransactionState, dispatch, dispatchEvent]);

  return (
    <TroveEditor
      original={original}
      edited={edited}
      fee={feeFrom(original, edited, borrowingRate)}
      borrowingRate={borrowingRate}
      changePending={changePending}
      dispatch={dispatch}
    >
      {description ??
        (openingNewTrove ? (
          <ActionDescription>
            {`Start by entering the amount of ${getPathName(
              location
            ).toUpperCase()} you'd like to deposit as collateral.`}
          </ActionDescription>
        ) : (
          <ActionDescription>
            Adjust your Trove by modifying its collateral, debt, or both.
          </ActionDescription>
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
          <TroveAction
            transactionId={`${transactionIdPrefix}${validChange.type}`}
            change={validChange}
            maxBorrowingRate={maxBorrowingRate}
            borrowingFeeDecayToleranceMinutes={60}
          >
            Confirm
          </TroveAction>
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
    </TroveEditor>
  );
};
