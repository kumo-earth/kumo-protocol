import { Button } from "theme-ui";

import { Decimal } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type RedemptionActionProps = {
  transactionId: string;
  disabled?: boolean;
  kusdAmount: Decimal;
  maxRedemptionRate: Decimal;
};

export const RedemptionAction: React.FC<RedemptionActionProps> = ({
  transactionId,
  disabled,
  kusdAmount,
  maxRedemptionRate
}) => {
  const {
    liquity: { send: liquity }
  } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    liquity.redeemKUSD.bind(liquity, kusdAmount, maxRedemptionRate)
  );

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};
