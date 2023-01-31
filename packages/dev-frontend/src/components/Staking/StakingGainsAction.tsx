import { Button } from "theme-ui";

import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";

const selectKUMOStake = ({ kumoStake }: KumoStoreState) => kumoStake;

export const StakingGainsAction: React.FC = () => {
  const { kumo } = useKumo();
  const { collateralGain, kusdGain } = useKumoSelector(selectKUMOStake);

  const [sendTransaction] = useTransactionFunction(
    "stake",
    kumo.send.withdrawGainsFromStaking.bind(kumo.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={collateralGain.isZero && kusdGain.isZero}>
      Claim gains
    </Button>
  );
};
