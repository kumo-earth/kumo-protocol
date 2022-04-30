import React, { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";

import { KumoStoreState } from "@liquity/lib-base";
import { useKumoSelector } from "@liquity/lib-react";

import { useDashboard } from "../../hooks/DashboardContext";

import { COIN, GT } from "../../strings";
import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { useMyTransactionState } from "../Transaction";
import { DisabledEditableRow, StaticRow } from "../Trove/Editor";
import { ClaimAndMove } from "./actions/ClaimAndMove";
import { ClaimRewards } from "./actions/ClaimRewards";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingKUMO } from "./RemainingKUMO";
import { Yield } from "./Yield";
import { InfoIcon } from "../InfoIcon";

const selector = ({ stabilityDeposit, trove, kusdInStabilityPool }: KumoStoreState) => ({
  stabilityDeposit,
  trove,
  kusdInStabilityPool
});

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const ActiveDeposit: React.FC = () => {
  const { dispatchEvent } = useStabilityView();
  const location = useLocation();
  const { vaults } = useDashboard();
  const vaultType = vaults.find(vault => vault.type === getPathName(location)) || vaults[0];
  const { kusdInStabilityPool } = useKumoSelector(selector);
  const { stabilityDeposit, trove } = vaultType;

  const poolShare = stabilityDeposit.currentKUSD.mulDiv(100, kusdInStabilityPool);

  const handleAdjustDeposit = useCallback(() => {
    dispatchEvent("ADJUST_DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  const hasReward = !stabilityDeposit.kumoReward.isZero;
  const hasGain = !stabilityDeposit.collateralGain.isZero;
  const hasTrove = !trove.isEmpty;

  const transactionId = "stability-deposit";
  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("REWARDS_CLAIMED");
    }
  }, [transactionState.type, dispatchEvent]);

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
        {getPathName(location).toUpperCase()} Stability Pool
        {!isWaitingForTransaction && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingKUMO />
          </Flex>
        )}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Deposit"
            inputId="deposit-kusd"
            amount={stabilityDeposit.currentKUSD.prettify()}
            unit={COIN}
          />

          <StaticRow
            label="Pool share"
            inputId="deposit-share"
            amount={poolShare.prettify(4)}
            unit="%"
          />

          <StaticRow
            label="Liquidation gain"
            inputId="deposit-gain"
            amount={stabilityDeposit.collateralGain.prettify(4)}
            color={stabilityDeposit.collateralGain.nonZero && "success"}
            unit={getPathName(location).toUpperCase()}
          />

          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={stabilityDeposit.kumoReward.prettify()}
              color={stabilityDeposit.kumoReward.nonZero && "success"}
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
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button
            sx={{
              backgroundColor: "rgb(152, 80, 90)",
              boxShadow:
                "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
              border: "none",
              color: "white"
            }}
            variant="outline"
            onClick={handleAdjustDeposit}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>

          <ClaimRewards disabled={!hasGain && !hasReward}>
            Claim {getPathName(location).toUpperCase()} and LQTY
          </ClaimRewards>
        </Flex>

        {hasTrove && (
          <ClaimAndMove disabled={!hasGain}>
            Claim KUMO and move {getPathName(location).toUpperCase()} to Trove
          </ClaimAndMove>
        )}
      </Box>

      {isWaitingForTransaction && <LoadingOverlay />}
    </Card>
  );
};
