import React, { useEffect, useState } from "react";
import { Button, Text, Box, Flex, Card, Heading, Select } from "theme-ui";

import {
  Decimal,
  Percent,
  KumoStoreState,
  MINIMUM_COLLATERAL_RATIO,
  Vault
} from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { COIN } from "../../strings";

import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";
import { useMyTransactionState } from "../Transaction";

import { RedemptionAction } from "./RedemptionAction";
import { InfoIcon } from "../InfoIcon";
import { useParams } from "react-router-dom";
import { useDashboard } from "../../hooks/DashboardContext";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);

const select = ({ vaults, kusdBalance }: KumoStoreState) => ({
  vaults,
  kusdBalance
});

const transactionId = "redemption";

export const RedemptionManager: React.FC = () => {
  const [assetType, setAssetType] = useState("ctx");
  const { vaults, kusdBalance } = useKumoSelector(select);
  const { ctx, cty } = useDashboard();
  const vault = vaults.find(vault => vault.asset === assetType) || new Vault();
  const price = vault?.asset === "ctx" ? ctx : vault?.asset === "cty" ? cty : Decimal.from(0);
  const { fees, total } = vault;
  const [kusdAmount, setKUSDAmount] = useState(Decimal.ZERO);
  const [changePending, setChangePending] = useState(false);
  const editingState = useState<string>();

  const dirty = !kusdAmount.isZero;
  const ethAmount = kusdAmount.div(price);
  const redemptionRate = fees.redemptionRate(kusdAmount.div(total.debt));
  const feePct = new Percent(redemptionRate);
  const ethFee = ethAmount.mul(redemptionRate);
  const maxRedemptionRate = redemptionRate.add(0.001); // TODO slippage tolerance

  const myTransactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    } else if (myTransactionState.type === "confirmed") {
      setKUSDAmount(Decimal.ZERO);
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setKUSDAmount]);

  const [canRedeem, description] = total.collateralRatioIsBelowMinimum(price)
    ? [
        false,
        <ErrorDescription>
          You can't redeem KUSD when the total collateral ratio is less than{" "}
          <Amount>{mcrPercent}</Amount>. Please try again later.
        </ErrorDescription>
      ]
    : kusdAmount.gt(kusdBalance)
    ? [
        false,
        <ErrorDescription>
          The amount you're trying to redeem exceeds your balance by{" "}
          <Amount>
            {kusdAmount.sub(kusdBalance).prettify()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [
        true,
        <ActionDescription>
          You will receive{" "}
          <Amount>
            {ethAmount.sub(ethFee).prettify(0)} {assetType?.toUpperCase()}
          </Amount>{" "}
          in exchange for{" "}
          <Amount>
            {kusdAmount.prettify(0)} {COIN}
          </Amount>
          .
        </ActionDescription>
      ];

  return (
    <Card variant="collateralCard">
      <Heading
        as="h2"
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        Redeem
        <Box sx={{ display: "flex", alignItems: "center", mr: 7 }}>
          {dirty && !changePending && (
            <Button
              variant="titleIcon"
              sx={{ ":enabled:hover": { color: "danger" } }}
              onClick={() => setKUSDAmount(Decimal.ZERO)}
            >
              <Icon name="history" size="xs" />
            </Button>
          )}
          <Text sx={{ fontSize: "14px" }}>Vault: </Text>
          <Select value={assetType} onChange={event => setAssetType(event.target.value)}>
            <option value={"ctx"}>CTX</option>
            <option value={"cty"}>CTY</option>
          </Select>
        </Box>
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Redeem"
          inputId="redeem-kusd"
          amount={kusdAmount.prettify()}
          maxAmount={kusdBalance.toString()}
          maxedOut={kusdAmount.eq(kusdBalance)}
          unit={COIN}
          {...{ editingState }}
          editedAmount={kusdAmount.toString(2)}
          setEditedAmount={amount => setKUSDAmount(Decimal.from(amount))}
        />

        <StaticRow
          label="Redemption Fee"
          inputId="redeem-fee"
          amount={ethFee.toString(4)}
          pendingAmount={feePct.toString(2)}
          unit={assetType?.toUpperCase()}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ minWidth: "240px" }}>
                  {`The Redemption Fee is charged as a percentage of the redeemed ${assetType?.toUpperCase()}. The Redemption
                  Fee depends on KUSD redemption volumes and is 0.5% at minimum.`}
                </Card>
              }
            />
          }
        />

        {((dirty || !canRedeem) && description) || (
          <ActionDescription>Enter the amount of {COIN} you'd like to redeem.</ActionDescription>
        )}
    
        <Flex variant="layout.actions">
          <RedemptionAction
            transactionId={transactionId}
            asset={vault?.assetAddress}
            disabled={!dirty || !canRedeem}
            kusdAmount={kusdAmount}
            maxRedemptionRate={maxRedemptionRate}
          />
        </Flex>
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
