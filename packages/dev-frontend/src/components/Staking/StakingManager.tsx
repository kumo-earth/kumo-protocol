import React from "react";
import { Button, Flex } from "theme-ui";

import { Decimal, Decimalish, KumoStoreState, KUMOStake, KUMOStakeChange } from "@kumodao/lib-base";

import { KumoStoreUpdate, useKumoReducer, useKumoSelector } from "@kumodao/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";

const init = ({ kumoStake }: KumoStoreState) => {
  return {
    originalStake: kumoStake,
    editedKUMO: kumoStake.stakedKUMO
  };
};

type StakeManagerState = ReturnType<typeof init>;
type StakeManagerAction =
  | KumoStoreUpdate
  | { type: "revert" }
  | { type: "setStake"; newValue: Decimalish };

const reduce = (state: StakeManagerState, action: StakeManagerAction): StakeManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedKUMO } = state;

  switch (action.type) {
    case "setStake":
      return { ...state, editedKUMO: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedKUMO: originalStake.stakedKUMO };

    case "updateStore": {
      const {
        stateChange: { kumoStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedKUMO: updatedStake.apply(originalStake.whatChanged(editedKUMO))
        };
      }
    }
  }

  return state;
};

const selectKUMOBalance = ({ kumoBalance }: KumoStoreState) => kumoBalance;

type StakingManagerActionDescriptionProps = {
  originalStake: KUMOStake;
  change: KUMOStakeChange<Decimal>;
};

const StakingManagerActionDescription: React.FC<StakingManagerActionDescriptionProps> = ({
  originalStake,
  change
}) => {
  const stakeKUMO = change.stakeKUMO?.prettify().concat(" ", GT);
  const unstakeKUMO = change.unstakeKUMO?.prettify().concat(" ", GT);
  const collateralGain = originalStake.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const kusdGain = originalStake.kusdGain.nonZero?.prettify().concat(" ", COIN);

  if (originalStake.isEmpty && stakeKUMO) {
    return (
      <ActionDescription>
        You are staking <Amount>{stakeKUMO}</Amount>.
      </ActionDescription>
    );
  }

  return (
    <ActionDescription>
      {stakeKUMO && (
        <>
          You are adding <Amount>{stakeKUMO}</Amount> to your stake
        </>
      )}
      {unstakeKUMO && (
        <>
          You are withdrawing <Amount>{unstakeKUMO}</Amount> to your wallet
        </>
      )}
      {(collateralGain || kusdGain) && (
        <>
          {" "}
          and claiming{" "}
          {collateralGain && kusdGain ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{kusdGain}</Amount>
            </>
          ) : (
            <>
              <Amount>{collateralGain ?? kusdGain}</Amount>
            </>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};

export const StakingManager: React.FC = () => {
  const { dispatch: dispatchStakingViewAction } = useStakingView();
  const [{ originalStake, editedKUMO }, dispatch] = useKumoReducer(reduce, init);
  const kumoBalance = useKumoSelector(selectKUMOBalance);

  const change = originalStake.whatChanged(editedKUMO);
  const [validChange, description] = !change
    ? [undefined, undefined]
    : change.stakeKUMO?.gt(kumoBalance)
    ? [
        undefined,
        <ErrorDescription>
          The amount you're trying to stake exceeds your balance by{" "}
          <Amount>
            {change.stakeKUMO.sub(kumoBalance).prettify(0)} {GT}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [change, <StakingManagerActionDescription originalStake={originalStake} change={change} />];

  const makingNewStake = originalStake.isEmpty;

  return (
    <StakingEditor title={"Staking"} {...{ originalStake, editedKUMO, dispatch }}>
      {description ??
        (makingNewStake ? (
          <ActionDescription>Enter the amount of {GT} you'd like to stake.</ActionDescription>
        ) : (
          <ActionDescription>Adjust the {GT} amount to stake or withdraw.</ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button
          variant="secondary"
          onClick={() => dispatchStakingViewAction({ type: "cancelAdjusting" })}
        >
          CANCEL
        </Button>

        {validChange ? (
          <StakingManagerAction change={validChange}>CONFIRM</StakingManagerAction>
        ) : (
          <Button variant="primaryInActive" disabled>CONFIRM</Button>
        )}
      </Flex>
    </StakingEditor>
  );
};
