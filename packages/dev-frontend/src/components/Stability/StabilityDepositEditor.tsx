import React, { useState } from "react";
import { useLocation } from "react-router-dom";

import { Heading, Box, Card, Button } from "theme-ui";

import {
  Decimal,
  Decimalish,
  StabilityDeposit,
  KumoStoreState,
  Difference
} from "@kumodao/lib-base";

import { useKumoSelector } from "@kumodao/lib-react";

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

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
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

  const location = useLocation();

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

  let unit = ((getPathName(location) === "bct" && "Carbon Token X") || (getPathName(location) === "mco2" && "Biodiversity Token Y")) || ""


  return (
    <Card
      sx={{
        width: "90%"
      }}
      variant="base"
    >
      <Heading as="h2">
        {unit.toUpperCase()}  <span style={{ marginLeft: "20px" }}>Stability Pool</span>
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
              unit={getPathName(location).toUpperCase()}
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
