import React from "react";
import { Text } from "theme-ui";
import { useKumo } from "../../../hooks/KumoContext";
import { LP } from "../../../strings";
import { Transaction } from "../../Transaction";
import { Decimal } from "@kumodao/lib-base";
import { ActionDescription } from "../../ActionDescription";
import { useValidationState } from "../context/useValidationState";

type DescriptionProps = {
  amount: Decimal;
};

const transactionId = "farm-stake";

export const Description: React.FC<DescriptionProps> = ({ amount }) => {
  const {
    kumo: { send: kumo }
  } = useKumo();
  const { isValid, hasApproved, isWithdrawing, amountChanged } = useValidationState(amount);

  if (!hasApproved) {
    return (
      <ActionDescription>
        <Text>To stake your {LP} tokens you need to allow Kumo to stake them for you</Text>
      </ActionDescription>
    );
  }

  if (!isValid || amountChanged.isZero) {
    return null;
  }

  return (
    <ActionDescription>
      {isWithdrawing && (
        <Transaction id={transactionId} send={kumo.unstakeUniTokens.bind(kumo, amountChanged)}>
          <Text>
            You are unstaking {amountChanged.prettify(4)} {LP}
          </Text>
        </Transaction>
      )}
      {!isWithdrawing && (
        <Transaction id={transactionId} send={kumo.stakeUniTokens.bind(kumo, amountChanged)}>
          <Text>
            You are staking {amountChanged.prettify(4)} {LP}
          </Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
