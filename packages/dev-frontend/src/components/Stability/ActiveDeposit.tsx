import React, { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";

import { KumoStoreState, Vault } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

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

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const ActiveDeposit: React.FC = () => {
  const { dispatchEvent } = useStabilityView();
  const { collateralType } = useParams<{ collateralType: string }>();
  const { vaults } = useKumoSelector(select);
  const vault = vaults.find(vault => vault.asset === collateralType) || new Vault;
  const { stabilityDeposit, trove, kusdInStabilityPool } = vault;

  const poolShare = stabilityDeposit.currentKUSD.mulDiv(100, kusdInStabilityPool);

  console.log("ActiveDeposit3", vault)

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
        background: "#ebd8df"
      }}
      variant="base"
    >
      <Heading as="h2">
        {collateralType?.toUpperCase()} Stability Pool
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={() => dispatchEvent("CLOSE_MODAL_PRESSED")}
        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
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
            amount={poolShare.prettify(0)}
            unit="%"
          />

          <StaticRow
            label="Liquidation gain"
            inputId="deposit-gain"
            amount={stabilityDeposit.collateralGain.prettify(0)}
            color={stabilityDeposit.collateralGain.nonZero && "success"}
            unit={collateralType?.toUpperCase()}
          />

          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={stabilityDeposit.kumoReward.prettify(0)}
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
          <Button onClick={handleAdjustDeposit} sx={{ mt: 3, mb: 2 }}>
            <Icon name="pen" size="sm" />
            &nbsp;ADJUST
          </Button>

          <ClaimRewards disabled={!hasGain && !hasReward}>
            CLAIM {collateralType?.toUpperCase()} and KUMO
          </ClaimRewards>
          {hasTrove && (
            <ClaimAndMove disabled={!hasGain} asset={vault?.assetAddress} assetName={vault?.asset}>
              CLAIM KUMO and MOVE {collateralType?.toUpperCase()} to VAULT
            </ClaimAndMove>
          )}
        </Flex>


      </Box>

      {isWaitingForTransaction && <LoadingOverlay />}
    </Card>
  );
};
