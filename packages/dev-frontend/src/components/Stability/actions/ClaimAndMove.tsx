import React from "react";
import { Button } from "theme-ui";
import { useKumo } from "../../../hooks/KumoContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimAndMoveProps = {
  disabled?: boolean;
  asset?: string;
};

export const ClaimAndMove: React.FC<ClaimAndMoveProps> = ({ disabled, asset = "", children }) => {
  const { liquity } = useKumo();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    liquity.send.transferCollateralGainToTrove.bind(liquity.send, asset)
  );

  return (
    <Button
      variant="outline"
      sx={{ mt: 3, width: "100%" }}
      onClick={sendTransaction}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};
