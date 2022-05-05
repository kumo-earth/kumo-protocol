import React, { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { LP } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow, StaticRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useFarmView } from "../../context/FarmViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { Confirm } from "../Confirm";
import { Description } from "../Description";
import { Approve } from "../Approve";
import { Validation } from "../Validation";
import { useValidationState } from "../../context/useValidationState";
import { useKumoSelector } from "@kumodao/lib-react";
import { useDashboard } from "../../../../hooks/DashboardContext";

const transactionId = /farm-/;
const selector = ({ totalStakedUniTokens }: KumoStoreState) => ({ totalStakedUniTokens });

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const Staking: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const { totalStakedUniTokens } = useKumoSelector(selector);

  const [amount, setAmount] = useState<Decimal>(Decimal.from(0));
  const editingState = useState<string>();

  const location = useLocation();
  const { bctPrice, mco2Price } = useDashboard();

  const isDirty = !amount.isZero;

  const { maximumStake, hasSetMaximumStake } = useValidationState(amount);

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const nextTotalStakedUniTokens = totalStakedUniTokens.add(amount);

  const poolShare = amount.mulDiv(100, nextTotalStakedUniTokens);

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        {isDirty && !isTransactionPending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(Decimal.from(0))}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="amount-lp"
          amount={amount.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.toString(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
          maxAmount={maximumStake.toString()}
          maxedOut={hasSetMaximumStake}
          tokenPrice={
            getPathName(location) === "bct"
              ? bctPrice
              : getPathName(location) === "mco2"
              ? mco2Price
              : Decimal.ZERO
          }
        ></EditableRow>

        {poolShare.infinite ? (
          <StaticRow label="Pool share" inputId="farm-share" amount="N/A" />
        ) : (
          <StaticRow
            label="Pool share"
            inputId="farm-share"
            amount={poolShare.prettify(4)}
            unit="%"
          />
        )}

        {isDirty && <Validation amount={amount} />}
        <Description amount={amount} />

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <Approve amount={amount} />
          <Confirm amount={amount} />
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
