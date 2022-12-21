import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type TroveActionProps = {
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
      sx={{
        backgroundColor: "rgb(152, 80, 90)",
        boxShadow:
          "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
        border: "none",
        color: "white",
        mb: 2
      }}
    >
      {children}
    </Button>
  );
};
