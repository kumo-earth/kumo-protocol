import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Flex, Button } from "theme-ui";

import {
  KumoStoreState,
  Decimal,
  Trove,
  Decimalish,
  KUSD_MINIMUM_DEBT,
  UserTrove,
  ASSET_TOKENS,
  Fees,
  Vault
} from "@kumodao/lib-base";

import { KumoStoreUpdate, useKumoReducer, useKumoSelector } from "@kumodao/lib-react";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";

// import {
//   selectForTroveChangeValidation,
//   validateTroveChange
// } from "./validation/validateTroveChange";
import { validateTroveChange } from "./validation/validateTroveChange";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";
import { useDashboard } from "../../hooks/DashboardContext";

// const init = ({ trove }: KumoStoreState) => {
//   return {
//     original: trove,
//     edited: new Trove(trove.collateral, trove.debt),
//     changePending: false,
//     debtDirty: false,
//     addedMinimumDebt: false
//   };
// };
type TroveManagerStateType = {
  collateralType: string;
  original: UserTrove;
  edited: Trove;
  changePending: boolean;
  debtDirty: boolean;
  addedMinimumDebt: boolean;
};

type TroveManagerState = TroveManagerStateType;
type TroveManagerAction =
  | KumoStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" | "addMinimumDebt" | "removeMinimumDebt" }
  | { type: "setCollateral" | "setDebt"; newValue: Decimalish };

const reduceWith =
  (action: TroveManagerAction) =>
  (state: TroveManagerState): TroveManagerState =>
    reduce(state, action);

const addMinimumDebt = reduceWith({ type: "addMinimumDebt" });
const removeMinimumDebt = reduceWith({ type: "removeMinimumDebt" });
const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state: TroveManagerState, action: TroveManagerAction): TroveManagerState => {
  // console.log(state);
  // console.log(action);

  const { collateralType, original, edited, changePending, debtDirty, addedMinimumDebt } = state;

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
      const vault =
        action.stateChange.vaults?.find(vault => vault.asset === state.collateralType) ||
        new Vault();
      const newStateVualt =
        action.newState.vaults?.find(vault => vault.asset === state.collateralType) || new Vault();
      const changeCommitted = vault?.troveBeforeRedistribution;
      const trove = newStateVualt?.trove && newStateVualt?.trove;
      // const {
      //   newState: { trove },
      //   stateChange: { troveBeforeRedistribution: changeCommitted }
      // } = action;

      // const newState = {
      //   ...state,
      //   original: trove
      // };

      // if (changePending && changeCommitted) {
      //   return finishChange(revert(newState));
      // }

      // const change = original.whatChanged(edited, 0);

      // if (
      //   (change?.type === "creation" && !trove.isEmpty) ||
      //   (change?.type === "closure" && trove.isEmpty)
      // ) {
      //   return revert(newState);
      // }

      // return { ...newState, edited: trove.apply(change, 0) };
      // const {
      //   newState: { trove },
      //   // stateChange: { troveBeforeRedistribution: changeCommitted }
      // } = action;

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

// const select = (state: KumoStoreState) => ({
//   fees: state.fees,
//   validationContext: selectForTroveChangeValidation(state)
// });

const transactionIdPrefix = "trove-";
const transactionIdMatcher = new RegExp(`^${transactionIdPrefix}`);

type TroveManagerProps = {
  collateral?: Decimalish;
  debt?: Decimalish;
};

export const TroveManager: React.FC<TroveManagerProps> = ({ collateral, debt }) => {
  const { account } = useWeb3React<Web3Provider>();
  const { collateralType } = useParams<{ collateralType: string }>();
  const { ctx, cty } = useDashboard();
  const assetTokenAddress = ASSET_TOKENS[collateralType].assetAddress;
  const [{ original, edited, changePending }, dispatch] = useKumoReducer(
    reduce,
    ({ vaults }: KumoStoreState) => {
      const vault = vaults.find(vault => vault.asset === collateralType) || new Vault();
      const { trove } = vault;
      return {
        collateralType,
        original: trove,
        edited: new Trove(trove.collateral, trove.debt),
        changePending: false,
        debtDirty: false,
        addedMinimumDebt: false
      };
    }
  );
  // const { fees, validationContext } = useKumoSelector(select);
  const { fees, validationContext } = useKumoSelector((state: KumoStoreState) => {
    const { vaults, kusdBalance } = state;
    const vault = vaults.find(vault => vault.asset === collateralType) || new Vault();
    const { accountBalance, fees, total, numberOfTroves } = vault;

    const price = vault?.asset === "ctx" ? ctx : vault?.asset === "cty" ? cty : Decimal.from(0);

    const validationContext = {
      // ...selectForTroveChangeValidation({ price, accountBalance,  }),
      price,
      total,
      accountBalance,
      kusdBalance,
      numberOfTroves
    };
    return { vault, accountBalance, fees, validationContext };
  });

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
            {`Start by entering the amount of ${collateralType.toUpperCase()} you'd like to deposit as collateral.`}
          </ActionDescription>
        ) : (
          <ActionDescription>
            Adjust your Vault by modifying its collateral, debt, or both.
          </ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button
          sx={{
            border: "none"
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
            asset={assetTokenAddress}
            maxBorrowingRate={maxBorrowingRate}
            borrowingFeeDecayToleranceMinutes={60}
          >
            Confirm
          </TroveAction>
        ) : (
          <Button
            sx={{
              border: "none"
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
