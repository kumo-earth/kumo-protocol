import React, { ReactNode } from "react";
import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type TroveActionProps = {
  children: ReactNode,
  transactionId: string;
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  asset: string;
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  transactionId,
  change,
  asset,
  maxBorrowingRate,
  borrowingFeeDecayToleranceMinutes
}) => {
  const { kumo } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? kumo.send.openTrove.bind(kumo.send, change.params, asset, {
        maxBorrowingRate,
        borrowingFeeDecayToleranceMinutes
      })
      : change.type === "closure"
        ? kumo.send.closeTrove.bind(kumo.send, asset)
        : kumo.send.adjustTrove.bind(kumo.send, change.params, asset, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
  );

  return (
    <Button
      onClick={sendTransaction}
    >
      {children}
    </Button>
  );
};
