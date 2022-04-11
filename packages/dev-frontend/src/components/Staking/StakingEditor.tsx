import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, Difference, LiquityStoreState, KUMOStake } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";

import { useStakingView } from "./context/StakingViewContext";

const select = ({ kumoBalance, totalStakedKUMO }: LiquityStoreState) => ({
  kumoBalance,
  totalStakedKUMO
});

type StakingEditorProps = {
  title: string;
  originalStake: KUMOStake;
  editedKUMO: Decimal;
  dispatch: (action: { type: "setStake"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StakingEditor: React.FC<StakingEditorProps> = ({
  children,
  title,
  originalStake,
  editedKUMO,
  dispatch
}) => {
  const { kumoBalance, totalStakedKUMO } = useLiquitySelector(select);
  const { changePending } = useStakingView();
  const editingState = useState<string>();

  const edited = !editedKUMO.eq(originalStake.stakedKUMO);

  const maxAmount = originalStake.stakedKUMO.add(kumoBalance);
  const maxedOut = editedKUMO.eq(maxAmount);

  const totalStakedKUMOAfterChange = totalStakedKUMO.sub(originalStake.stakedKUMO).add(editedKUMO);

  const originalPoolShare = originalStake.stakedKUMO.mulDiv(100, totalStakedKUMO);
  const newPoolShare = editedKUMO.mulDiv(100, totalStakedKUMOAfterChange);
  const poolShareChange =
    originalStake.stakedKUMO.nonZero && Difference.between(newPoolShare, originalPoolShare).nonZero;

  return (
    <Card>
      <Heading>
        {title}
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => dispatch({ type: "revert" })}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="stake-kumo"
          amount={editedKUMO.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={GT}
          {...{ editingState }}
          editedAmount={editedKUMO.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setStake", newValue })}
        />

        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" inputId="stake-share" amount="N/A" />
        ) : (
          <StaticRow
            label="Pool share"
            inputId="stake-share"
            amount={newPoolShare.prettify(4)}
            pendingAmount={poolShareChange?.prettify(4).concat("%")}
            pendingColor={poolShareChange?.positive ? "success" : "danger"}
            unit="%"
          />
        )}

        {!originalStake.isEmpty && (
          <>
            <StaticRow
              label="Redemption gain"
              inputId="stake-gain-eth"
              amount={originalStake.collateralGain.prettify(4)}
              color={originalStake.collateralGain.nonZero && "success"}
              unit="ETH"
            />

            <StaticRow
              label="Issuance gain"
              inputId="stake-gain-kusd"
              amount={originalStake.kusdGain.prettify()}
              color={originalStake.kusdGain.nonZero && "success"}
              unit={COIN}
            />
          </>
        )}

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
