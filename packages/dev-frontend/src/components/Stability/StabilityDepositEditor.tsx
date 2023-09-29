import React, { ReactNode, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { Heading, Box, Card, Button, Text } from "theme-ui";

import {
  Decimal,
  Decimalish,
  StabilityDeposit,
  KumoStoreState,
  Difference,
  Vault
} from "@kumodao/lib-base";

import { useKumoSelector } from "@kumodao/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { InfoIcon } from "../InfoIcon";
import { useStabilityView } from "./context/StabilityViewContext";

const select = ({ vaults, kusdBalance }: KumoStoreState) => ({
  vaults,
  kusdBalance
});

type StabilityDepositEditorProps = {
  children: ReactNode,
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
  const { vaults, kusdBalance } = useKumoSelector(select);
  const editingState = useState<string>();
  const { collateralType } = useParams<{ collateralType: string }>();
  const { dispatchEvent } = useStabilityView();
  const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault();
  const { kusdInStabilityPool, assetName } = vault;
  const location = useLocation();

  const edited = !editedKUSD.eq(originalDeposit.currentKUSD);

  const maxAmount = originalDeposit.currentKUSD.add(kusdBalance);
  const maxedOut = editedKUSD.eq(maxAmount);  

  const kusdInStabilityPoolAfterChange =  (originalDeposit.currentKUSD.lte(kusdInStabilityPool)) ? kusdInStabilityPool
    .sub(originalDeposit.currentKUSD)
    .add(editedKUSD) : Decimal.ZERO;

  const originalPoolShare = originalDeposit.currentKUSD.mulDiv(100, kusdInStabilityPool);
  const newPoolShare = editedKUSD.mulDiv(100, kusdInStabilityPoolAfterChange);
  const poolShareChange =
    originalDeposit.currentKUSD.nonZero &&
    Difference.between(newPoolShare, originalPoolShare).nonZero;

  return (
    <Card variant="modalCard">
      <Heading as="h2">
        {getPathName(location).toUpperCase()} Stability Pool <Text variant="assetName">({assetName})</Text>
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => dispatch({ type: "revert" })}
          >
            <Icon name="history" size="xs" />
          </Button>
        )}
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={() => {
            dispatchEvent("CLOSE_MODAL_PRESSED");
            dispatchEvent("CANCEL_PRESSED");
          }}
        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
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
            amount={newPoolShare.prettify(0)}
            pendingAmount={poolShareChange?.prettify(0).concat("%")}
            pendingColor={poolShareChange?.positive ? "success" : "danger"}
            unit="%"
          />
        )}

        {!originalDeposit.isEmpty && (
          <>
            <StaticRow
              label="Liquidation gain"
              inputId="deposit-gain"
              amount={originalDeposit.collateralGain.prettify(0)}
              color={originalDeposit.collateralGain.nonZero && "success"}
              unit={getPathName(location).toUpperCase()}
            />

            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={originalDeposit.kumoReward.prettify(0)}
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
