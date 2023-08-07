import { Button } from "theme-ui";
import { Decimal, StabilityDepositChange } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
  asset: string,
};

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change,
  asset,
}) => {
  const { kumo } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositKUSD
      ? kumo.send.depositKUSDInStabilityPool.bind(kumo.send, change.depositKUSD, asset)
      : kumo.send.withdrawKUSDFromStabilityPool.bind(kumo.send, change.withdrawKUSD, asset)
  );

  return (
    <Button onClick={sendTransaction}>
      {children}
    </Button>
  );
};
