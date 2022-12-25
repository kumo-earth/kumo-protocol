import React from "react";
import { Button } from "theme-ui";
import { useKumo } from "../../../hooks/KumoContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimAndMoveProps = {
  disabled?: boolean;
  asset: string;
  assetName: string;
};

export const ClaimAndMove: React.FC<ClaimAndMoveProps> = ({
  disabled,
  asset,
  assetName,
  children
}) => {
  const { kumo } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    kumo.send.transferCollateralGainToTrove.bind(kumo.send, asset, assetName)
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
