import React, { useEffect } from "react";

import { Decimal, TroveChange } from "@kumodao/lib-base";
import { PopulatedEthersKumoTransaction } from "@kumodao/lib-ethers";

import { useKumo } from "../../hooks/KumoContext";
import { Warning } from "../Warning";

export type GasEstimationState =
  | { type: "idle" | "inProgress" }
  | { type: "complete"; populatedTx: PopulatedEthersKumoTransaction };

type ExpensiveTroveChangeWarningParams = {
  asset?: string;
  troveChange?: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
  gasEstimationState: GasEstimationState;
  setGasEstimationState: (newState: GasEstimationState) => void;
};

export const ExpensiveTroveChangeWarning: React.FC<ExpensiveTroveChangeWarningParams> = ({
  asset = "",
  troveChange,
  maxBorrowingRate,
  borrowingFeeDecayToleranceMinutes,
  gasEstimationState,
  setGasEstimationState
}) => {
  const { kumo } = useKumo();

  useEffect(() => {
    if (troveChange && troveChange.type !== "closure") {
      setGasEstimationState({ type: "inProgress" });

      let cancelled = false;

      const timeoutId = setTimeout(async () => {
        const populatedTx = await (troveChange.type === "creation"
          ? kumo.populate.openTrove(troveChange.params, asset, {
            maxBorrowingRate,
            borrowingFeeDecayToleranceMinutes
          })
          : kumo.populate.adjustTrove(troveChange.params, asset, {
            maxBorrowingRate,
            borrowingFeeDecayToleranceMinutes
          }));

        if (!cancelled) {
          setGasEstimationState({ type: "complete", populatedTx });
          console.log(
            "Estimated TX cost: " +
            Decimal.from(`${populatedTx.rawPopulatedTransaction.gasLimit}`).prettify(0)
          );
        }
      }, 333);

      return () => {
        clearTimeout(timeoutId);
        cancelled = true;
      };
    } else {
      setGasEstimationState({ type: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [troveChange]);

  if (
    troveChange &&
    gasEstimationState.type === "complete" &&
    gasEstimationState.populatedTx.gasHeadroom !== undefined &&
    gasEstimationState.populatedTx.gasHeadroom >= 200000
  ) {
    return troveChange.type === "creation" ? (
      <Warning>
        The cost of opening a Trove in this collateral ratio range is rather high. To lower it,
        choose a slightly different collateral ratio.
      </Warning>
    ) : (
      <Warning>
        The cost of adjusting a Trove into this collateral ratio range is rather high. To lower it,
        choose a slightly different collateral ratio.
      </Warning>
    );
  }

  return null;
};
