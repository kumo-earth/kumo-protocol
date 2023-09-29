import React, { useCallback, useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Flex, Button, Box, Card, Heading, Text } from "theme-ui";
import {
  KumoStoreState,
  Decimal,
  Trove,
  KUSD_LIQUIDATION_RESERVE,
  Percent,
  Difference,
  ASSET_TOKENS,
  Vault
} from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { useStableTroveChange } from "../../hooks/useStableTroveChange";
import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";
import { COIN } from "../../strings";
import { Icon } from "../Icon";
import { InfoIcon } from "../InfoIcon";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";
import { EditableRow, StaticRow } from "./Editor";
import { ExpensiveTroveChangeWarning, GasEstimationState } from "./ExpensiveTroveChangeWarning";
import { ErrorDescription } from "../ErrorDescription";
import { validateTroveChange } from "./validation/validateTroveChange";

const TRANSACTION_ID = "trove-adjustment";
const GAS_ROOM_ETH = Decimal.from(0.1);

const feeFrom = (original: Trove, edited: Trove, borrowingRate: Decimal): Decimal => {
  const change = original.whatChanged(edited, borrowingRate);

  if (change && change.type !== "invalidCreation" && change.params.borrowKUSD) {
    return change.params.borrowKUSD.mul(borrowingRate);
  } else {
    return Decimal.ZERO;
  }
};

const applyUnsavedCollateralChanges = (unsavedChanges: Difference, trove: Trove) => {
  if (unsavedChanges.absoluteValue) {
    if (unsavedChanges.positive) {
      return trove.collateral.add(unsavedChanges.absoluteValue);
    }
    if (unsavedChanges.negative) {
      if (unsavedChanges.absoluteValue.lt(trove.collateral)) {
        return trove.collateral.sub(unsavedChanges.absoluteValue);
      }
    }
    return trove.collateral;
  }
  return trove.collateral;
};

const applyUnsavedNetDebtChanges = (unsavedChanges: Difference, trove: Trove) => {
  if (unsavedChanges.absoluteValue) {
    if (unsavedChanges.positive) {
      return trove.netDebt.add(unsavedChanges.absoluteValue);
    }
    if (unsavedChanges.negative) {
      if (unsavedChanges.absoluteValue.lt(trove.netDebt)) {
        return trove.netDebt.sub(unsavedChanges.absoluteValue);
      }
    }
    return trove.netDebt;
  }
  return trove.netDebt;
};

export const Adjusting: React.FC = () => {
  const { dispatchEvent } = useTroveView();
  const { collateralType = "nbc" || "csc" } = useParams<{ collateralType: string }>();
  const { vault, price, trove, accountBalance, fees, validationContext } = useKumoSelector(
    (state: KumoStoreState) => {
      const { vaults, kusdBalance } = state;
      const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault();
      const { numberOfTroves, total, fees, accountBalance, trove } = vault;

      const price = vault?.price

      const validationContext = {
        trove,
        price,
        total,
        accountBalance,
        kusdBalance,
        numberOfTroves
      };
      return { vault, price, trove, accountBalance, fees, validationContext };
    }
  );
  const assetTokenAddress = ASSET_TOKENS[collateralType].assetAddress;

  const { kusdMintedCap, total } = vault
  const editingState = useState<string>();
  const previousTrove = useRef<Trove>(trove);
  const [collateral, setCollateral] = useState<Decimal>(trove.collateral);
  const [netDebt, setNetDebt] = useState<Decimal>(trove.netDebt);

  const transactionState = useMyTransactionState(TRANSACTION_ID);
  const borrowingRate = fees.borrowingRate();

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_ADJUSTED");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionState.type, dispatchEvent]);

  useEffect(() => {
    if (!previousTrove.current.collateral.eq(trove.collateral)) {
      const unsavedChanges = Difference.between(collateral, previousTrove.current.collateral);
      const nextCollateral = applyUnsavedCollateralChanges(unsavedChanges, trove);
      setCollateral(nextCollateral);
    }
    if (!previousTrove.current.netDebt.eq(trove.netDebt)) {
      const unsavedChanges = Difference.between(netDebt, previousTrove.current.netDebt);
      const nextNetDebt = applyUnsavedNetDebtChanges(unsavedChanges, trove);
      setNetDebt(nextNetDebt);
    }
    previousTrove.current = trove;
  }, [trove, collateral, netDebt]);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);

  const reset = useCallback(() => {
    setCollateral(trove.collateral);
    setNetDebt(trove.netDebt);
  }, [trove.collateral, trove.netDebt]);

  const isDirty = !collateral.eq(trove.collateral) || !netDebt.eq(trove.netDebt);
  const isDebtIncrease = netDebt.gt(trove.netDebt);
  const debtIncreaseAmount = isDebtIncrease ? netDebt.sub(trove.netDebt) : Decimal.ZERO;

  const fee = isDebtIncrease
    ? feeFrom(trove, new Trove(trove.collateral, trove.debt.add(debtIncreaseAmount)), borrowingRate)
    : Decimal.ZERO;
  const totalDebt = netDebt.add(KUSD_LIQUIDATION_RESERVE).add(fee);
  const maxBorrowingRate = borrowingRate.add(0.005);
  const updatedTrove = isDirty ? new Trove(collateral, totalDebt) : trove;
  const feePct = new Percent(borrowingRate);
  const availableTokens = accountBalance?.gt(GAS_ROOM_ETH)
    ? accountBalance.sub(GAS_ROOM_ETH)
    : Decimal.ZERO;
  const maxCollateral = trove.collateral.add(availableTokens);
  const collateralMaxedOut = collateral.eq(maxCollateral);
  const collateralRatio =
    !collateral.isZero && !netDebt.isZero ? updatedTrove.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, trove.collateralRatio(price));

  const [troveChange, description] = validateTroveChange(
    trove,
    updatedTrove,
    borrowingRate,
    validationContext
  );
  const stableTroveChange = useStableTroveChange(troveChange);
  const isMintCapReached = (totalDebt.add(total.debt)).gt(kusdMintedCap)

  const [gasEstimationState, setGasEstimationState] = useState<GasEstimationState>({ type: "idle" });

  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";
  if (trove.status !== "open") {
    return null;
  }

  return (
    <Card variant="base">
      <Heading>
        {vault?.asset.toUpperCase()} Vault <Text variant="assetName">({vault.assetName})</Text>
        {isDirty && !isTransactionPending && (
          <Button variant="titleIcon" sx={{ ":enabled:hover": { color: "danger" } }} onClick={reset}>
            <Icon name="history" size="xs" />
          </Button>
        )}
      </Heading>

      <Box sx={{ py: 4, px: [3, 5] }}>
        <EditableRow
          label="Collateral"
          inputId="trove-collateral"
          amount={collateral.prettify(0)}
          maxAmount={maxCollateral.toString()}
          maxedOut={collateralMaxedOut}
          editingState={editingState}
          unit={collateralType?.toUpperCase()}
          editedAmount={collateral.toString(0)}
          setEditedAmount={(amount: string) => {
            setCollateral(Decimal.from(amount));
          }}
          tokenPrice={price}
        />

        <EditableRow
          label="Net debt"
          inputId="trove-net-debt-amount"
          amount={netDebt.prettify()}
          unit={COIN}
          editingState={editingState}
          editedAmount={netDebt.toString(2)}
          setEditedAmount={(amount: string) => setNetDebt(Decimal.from(amount))}
        />

        <StaticRow
          label="Liquidation Reserve"
          inputId="trove-liquidation-reserve"
          amount={`${KUSD_LIQUIDATION_RESERVE}`}
          unit={COIN}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "200px" }}>
                  An amount set aside to cover the liquidator’s gas costs if your Vault needs to be
                  liquidated. The amount increases your debt and is refunded if you close your Vault
                  by fully paying off its net debt.
                </Card>
              }
            />
          }
        />

        <StaticRow
          label="Borrowing Fee"
          inputId="trove-borrowing-fee"
          amount={fee.prettify(2)}
          pendingAmount={feePct.toString(2)}
          unit={COIN}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "240px" }}>
                  This amount is deducted from the borrowed amount as a one-time fee. There are no
                  recurring fees for borrowing, which is thus interest-free.
                </Card>
              }
            />
          }
        />

        <StaticRow
          label="Total debt"
          inputId="trove-total-debt"
          amount={totalDebt.prettify(2)}
          unit={COIN}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "240px" }}>
                  The total amount of KUSD your Vault will hold.{" "}
                  {isDirty && (
                    <>
                      You will need to repay {totalDebt.sub(KUSD_LIQUIDATION_RESERVE).prettify(0)}{" "}
                      KUSD to reclaim your collateral ({KUSD_LIQUIDATION_RESERVE.toString()} KUSD
                      Liquidation Reserve excluded).
                    </>
                  )}
                </Card>
              }
            />
          }
        />

        <CollateralRatio value={collateralRatio} change={collateralRatioChange} />

        {description ?? (
          <ActionDescription>
            Adjust your Vault by modifying its collateral, debt, or both.
          </ActionDescription>
        )}

        {
          isMintCapReached && (
            <ErrorDescription>
              Total debt {totalDebt.prettify(2)} {COIN} must be less than {COIN} Minted Cap {kusdMintedCap.shorten().toString().toLowerCase()} {COIN}
            </ErrorDescription>
          )
        }

        <ExpensiveTroveChangeWarning
          asset={assetTokenAddress}
          troveChange={stableTroveChange}
          maxBorrowingRate={maxBorrowingRate}
          borrowingFeeDecayToleranceMinutes={60}
          gasEstimationState={gasEstimationState}
          setGasEstimationState={setGasEstimationState}
        />

        <Flex variant="layout.actions">
          <Button
            sx={{
              mt: 3,
              mb: 3
            }}
            variant="secondary"
            onClick={handleCancelPressed}
          >
            CANCEL
          </Button>

          {(stableTroveChange && !isMintCapReached) ? (
            <TroveAction
              transactionId={TRANSACTION_ID}
              change={stableTroveChange}
              asset={assetTokenAddress}
              maxBorrowingRate={maxBorrowingRate}
              borrowingFeeDecayToleranceMinutes={60}
            >
              CONFIRM
            </TroveAction>
          ) : (
            <Button
              variant="primaryInActive"
              disabled
            >
              CONFIRM
            </Button>
          )}
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
