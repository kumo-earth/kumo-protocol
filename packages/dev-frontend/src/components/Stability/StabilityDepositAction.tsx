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

  return (
    <Button
      sx={{
        backgroundColor: "rgb(152, 80, 90)",
        boxShadow:
          "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
        border: "none",
        color: "white"
      }}
      onClick={sendTransaction}
    >
      {children}
    </Button>
  );
};
