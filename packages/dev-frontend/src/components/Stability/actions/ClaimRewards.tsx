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
      sx={{
        backgroundColor: "rgb(152, 80, 90)",
        boxShadow:
          "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
        border: "none",
        color: "white"
      }}
      onClick={sendTransaction}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};
