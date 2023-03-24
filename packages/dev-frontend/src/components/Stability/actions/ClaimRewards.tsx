import React from "react";
import { useParams } from "react-router-dom";
import { Button } from "theme-ui";

import { useKumo } from "../../../hooks/KumoContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimRewardsProps = {
  disabled?: boolean;
};

export const ClaimRewards: React.FC<ClaimRewardsProps> = ({ disabled, children }) => {
  const { kumo } = useKumo();
  const { collateralType } = useParams<{ collateralType: string }>();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    kumo.send.withdrawGainsFromStabilityPool.bind(kumo.send, collateralType)
  );

  return (
    <Button
      sx={{ mb: 2 }}
      onClick={sendTransaction}
      disabled={disabled}
      variant={ disabled ? 'primaryInActive' : 'primary' }
    >
      {children}
    </Button>
  );
};
