import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type TroveActionProps = {
  transactionId: string;
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  asset?: string;
  tokenAmount?: Decimal;
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  transactionId,
  change,
  asset = "",
  tokenAmount = Decimal.from(0),
  maxBorrowingRate,
  borrowingFeeDecayToleranceMinutes
}) => {
  const { liquity } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? liquity.send.openTrove.bind(liquity.send, change.params, asset, tokenAmount, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
      : change.type === "closure"
      ? liquity.send.closeTrove.bind(liquity.send, asset)
      : liquity.send.adjustTrove.bind(liquity.send, change.params, asset, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
