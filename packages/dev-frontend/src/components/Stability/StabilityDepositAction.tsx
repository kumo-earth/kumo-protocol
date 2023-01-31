import { Button } from "theme-ui";
import { Decimal, KumoStoreState, StabilityDepositChange } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
  asset: string,
};

const selectFrontendRegistered = ({ frontend }: KumoStoreState) =>
  frontend.status === "registered";

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change,
  asset,
}) => {
  const { config, kumo } = useKumo();
  const frontendRegistered = useKumoSelector(selectFrontendRegistered);

  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositKUSD
      ? kumo.send.depositKUSDInStabilityPool.bind(kumo.send, change.depositKUSD, asset,  frontendTag)
      : kumo.send.withdrawKUSDFromStabilityPool.bind(kumo.send, change.withdrawKUSD, asset)
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
