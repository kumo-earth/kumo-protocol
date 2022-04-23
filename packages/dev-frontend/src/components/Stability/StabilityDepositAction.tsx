import { Button } from "theme-ui";
import { Decimal, KumoStoreState, StabilityDepositChange } from "@liquity/lib-base";
import { useKumoSelector } from "@liquity/lib-react";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
};

const selectFrontendRegistered = ({ frontend }: KumoStoreState) =>
  frontend.status === "registered";

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change
}) => {
  const { config, liquity } = useKumo();
  const frontendRegistered = useKumoSelector(selectFrontendRegistered);

  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositKUSD
      ? liquity.send.depositKUSDInStabilityPool.bind(liquity.send, change.depositKUSD, frontendTag)
      : liquity.send.withdrawKUSDFromStabilityPool.bind(liquity.send, change.withdrawKUSD)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
