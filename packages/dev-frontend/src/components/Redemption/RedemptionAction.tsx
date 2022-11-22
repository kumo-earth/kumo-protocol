import { Button } from "theme-ui";

import { Decimal } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type RedemptionActionProps = {
  transactionId: string;
  asset?: string;
  disabled?: boolean;
  kusdAmount: Decimal;
  maxRedemptionRate: Decimal;
};

export const RedemptionAction: React.FC<RedemptionActionProps> = ({
  transactionId,
  asset = "",
  disabled,
  kusdAmount,
  maxRedemptionRate
}) => {
  const {
    kumo: { send: kumo }
  } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    kumo.redeemKUSD.bind(kumo, asset, kusdAmount, maxRedemptionRate)
  );

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};
