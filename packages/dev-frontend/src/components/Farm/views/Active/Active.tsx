import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { Icon } from "../../../Icon";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMyTransactionState } from "../../../Transaction";
import { DisabledEditableRow, StaticRow } from "../../../Trove/Editor";
import { useFarmView } from "../../context/FarmViewContext";
import { RemainingKUMO } from "../RemainingKUMO";
import { ClaimReward } from "./ClaimReward";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { Yield } from "../Yield";

const selector = ({
  liquidityMiningStake,
  liquidityMiningKUMOReward,
  totalStakedUniTokens
}: KumoStoreState) => ({
  liquidityMiningStake,
  liquidityMiningKUMOReward,
  totalStakedUniTokens
});
const transactionId = /farm-/i;

export const Active: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const {
    liquidityMiningStake,
    liquidityMiningKUMOReward,
    totalStakedUniTokens
  } = useKumoSelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const poolShare = liquidityMiningStake.mulDiv(100, totalStakedUniTokens);
  const hasStakeAndRewards = !liquidityMiningStake.isZero && !liquidityMiningKUMOReward.isZero;

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        {!isTransactionPending && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingKUMO />
          </Flex>
        )}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Stake"
            inputId="farm-stake"
            amount={liquidityMiningStake.prettify(4)}
            unit={LP}
          />
          {poolShare.infinite ? (
            <StaticRow label="Pool share" inputId="farm-share" amount="N/A" />
          ) : (
            <StaticRow
              label="Pool share"
              inputId="farm-share"
              amount={poolShare.prettify(4)}
              unit={"%"}
            />
          )}
          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="farm-reward"
              amount={liquidityMiningKUMOReward.prettify(4)}
              color={liquidityMiningKUMOReward.nonZero && "success"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant={!liquidityMiningKUMOReward.isZero ? "outline" : "primary"}
            onClick={handleAdjustPressed}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          {!liquidityMiningKUMOReward.isZero && <ClaimReward />}
        </Flex>
        <Flex>{hasStakeAndRewards && <UnstakeAndClaim />}</Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
