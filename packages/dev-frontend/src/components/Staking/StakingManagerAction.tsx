import { Button } from "theme-ui";

import { Decimal, KUMOStakeChange } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  change: KUMOStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeKUMO
      ? liquity.send.stakeKUMO.bind(liquity.send, change.stakeKUMO)
      : liquity.send.unstakeKUMO.bind(liquity.send, change.unstakeKUMO)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
