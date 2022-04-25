import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import {
  Decimal,
  Decimalish,
  StabilityDeposit,
  KumoStoreState,
  Difference
} from "@liquity/lib-base";

import { useKumoSelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { InfoIcon } from "../InfoIcon";

const select = ({ kusdBalance, kusdInStabilityPool }: KumoStoreState) => ({
  kusdBalance,
  kusdInStabilityPool
});

type StabilityDepositEditorProps = {
  originalDeposit: StabilityDeposit;
  editedKUSD: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  originalDeposit,
  editedKUSD,
  changePending,
  dispatch,
  children
}) => {
  const { kusdBalance, kusdInStabilityPool } = useKumoSelector(select);
  const editingState = useState<string>();

  const edited = !editedKUSD.eq(originalDeposit.currentKUSD);

  const maxAmount = originalDeposit.currentKUSD.add(kusdBalance);
  const maxedOut = editedKUSD.eq(maxAmount);

  const kusdInStabilityPoolAfterChange = kusdInStabilityPool
    .sub(originalDeposit.currentKUSD)
    .add(editedKUSD);

  const originalPoolShare = originalDeposit.currentKUSD.mulDiv(100, kusdInStabilityPool);
  const newPoolShare = editedKUSD.mulDiv(100, kusdInStabilityPoolAfterChange);
  const poolShareChange =
    originalDeposit.currentKUSD.nonZero &&
    Difference.between(newPoolShare, originalPoolShare).nonZero;

  return (
    <Card
      sx={{
        background: "rgba(249,248,249,.1)",
        backgroundColor: "#303553",
        // color: "rgba(0, 0, 0, 0.87)",
        transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        boxShadow:
          "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)",
        overflow: "hidden",
        borderRadius: "20px",
        width: "90%",
        color: "white"
      }}
    >
      <Heading
        sx={{
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          color: "white"
        }}
      >
        Stability Pool
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
          label="Deposit"
          inputId="deposit-kumo"
          amount={editedKUSD.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedKUSD.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setDeposit", newValue })}
        />

        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" inputId="deposit-share" amount="N/A" />
        ) : (
          <StaticRow
            label="Pool share"
            inputId="deposit-share"
            amount={newPoolShare.prettify(4)}
            pendingAmount={poolShareChange?.prettify(4).concat("%")}
            pendingColor={poolShareChange?.positive ? "success" : "danger"}
            unit="%"
          />
        )}

        {!originalDeposit.isEmpty && (
          <>
            <StaticRow
              label="Liquidation gain"
              inputId="deposit-gain"
              amount={originalDeposit.collateralGain.prettify(4)}
              color={originalDeposit.collateralGain.nonZero && "success"}
              unit="ETH"
            />

            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={originalDeposit.kumoReward.prettify()}
              color={originalDeposit.kumoReward.nonZero && "success"}
              unit={GT}
              infoIcon={
                <InfoIcon
                  tooltip={
                    <Card variant="tooltip" sx={{ width: "240px" }}>
                      Although the KUMO rewards accrue every minute, the value on the UI only updates
                      when a user transacts with the Stability Pool. Therefore you may receive more
                      rewards than is displayed when you claim or adjust your deposit.
                    </Card>
                  }
                />
              }
            />
          </>
        )}
        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
