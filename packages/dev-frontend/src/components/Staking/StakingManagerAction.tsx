import { ReactNode } from "react";
import { Button } from "theme-ui";

import { Decimal, KUMOStakeChange } from "@kumodao/lib-base";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  children: ReactNode,
  change: KUMOStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { kumo } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeKUMO
      ? kumo.send.stakeKUMO.bind(kumo.send, change.stakeKUMO)
      : kumo.send.unstakeKUMO.bind(kumo.send, change.unstakeKUMO)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
