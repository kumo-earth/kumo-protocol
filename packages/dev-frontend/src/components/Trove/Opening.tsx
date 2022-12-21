import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Flex, Button, Box, Card, Heading, Spinner } from "theme-ui";
import {
  KumoStoreState,
  Decimal,
  Trove,
  KUSD_LIQUIDATION_RESERVE,
  KUSD_MINIMUM_NET_DEBT,
  Percent,
  ASSET_TOKENS,
  Fees,
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
// import {
//   selectForTroveChangeValidation,
//   validateTroveChange
// } from "./validation/validateTroveChange";
import { validateTroveChange } from "./validation/validateTroveChange";

const EMPTY_TROVE = new Trove(Decimal.ZERO, Decimal.ZERO);
const TRANSACTION_ID = "trove-creation";
const GAS_ROOM_ETH = Decimal.from(0.1);

export const Opening: React.FC = () => {
  const { dispatchEvent } = useTroveView();
  const { collateralType } = useParams<{ collateralType: string }>();

  const { accountBalance, fees, price, validationContext } = useKumoSelector((state: KumoStoreState) => {
    const { vaults, kusdBalance } = state;
    const vault = vaults.find(vault => vault.asset === collateralType) || new Vault();
    const { accountBalance, fees, price, total, numberOfTroves } = vault;


    const validationContext = {
      // ...selectForTroveChangeValidation(state),
      price,
      total,
      accountBalance,
      kusdBalance,
      numberOfTroves
    };
    return { accountBalance, fees, price, validationContext };
  });

  const assetTokenAddress = ASSET_TOKENS[collateralType].assetAddress;

  const borrowingRate = fees.borrowingRate();
  const editingState = useState<string>();

  const [collateral, setCollateral] = useState<Decimal>(Decimal.ZERO);
  const [borrowAmount, setBorrowAmount] = useState<Decimal>(Decimal.ZERO);

  const maxBorrowingRate = borrowingRate.add(0.005);
 
  const fee = borrowAmount.mul(borrowingRate);
  const feePct = new Percent(borrowingRate);
  const totalDebt = borrowAmount.add(KUSD_LIQUIDATION_RESERVE).add(fee);
  const isDirty = !collateral.isZero || !borrowAmount.isZero;
  const trove = isDirty ? new Trove(collateral, totalDebt) : EMPTY_TROVE;

  const maxCollateral = accountBalance.gt(GAS_ROOM_ETH)
    ? accountBalance.sub(GAS_ROOM_ETH)
    : Decimal.ZERO;
  const collateralMaxedOut = collateral.eq(maxCollateral);
  const collateralRatio =
    !collateral.isZero && !borrowAmount.isZero ? trove.collateralRatio(price) : undefined;

  const [troveChange, description] = validateTroveChange(
    EMPTY_TROVE,
    trove,
    borrowingRate,
    validationContext
  );

  const stableTroveChange = useStableTroveChange(troveChange);
  const [gasEstimationState, setGasEstimationState] = useState<GasEstimationState>({ type: "idle" });

  const transactionState = useMyTransactionState(TRANSACTION_ID);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);

  const reset = useCallback(() => {
    setCollateral(Decimal.ZERO);
    setBorrowAmount(Decimal.ZERO);
  }, []);

  //   params:
  // borrowLUSD: Decimal {_bigNumber: BigNumber}
  // depositCollateral: Decimal {_bigNumber: BigNumber}
  // [[Prototype]]: Object
  // type: "creation"

  useEffect(() => {
    if (!collateral.isZero && borrowAmount.isZero) {
      setBorrowAmount(KUSD_MINIMUM_NET_DEBT);
    }
  }, [collateral, borrowAmount]);

  return (
    <Card variant="base">
      <Heading as="h2">
        {collateralType.toUpperCase()} Vault
        {isDirty && !isTransactionPending && (
          <Button variant="titleIcon" sx={{ ":enabled:hover": { color: "danger" } }} onClick={reset}>
            <Icon name="history" size="sm" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Collateral"
          inputId="trove-collateral"
          amount={collateral.prettify(4)}
          maxAmount={maxCollateral.toString()}
          maxedOut={collateralMaxedOut}
          editingState={editingState}
          unit={collateralType.toUpperCase()}
          editedAmount={collateral.toString(4)}
          setEditedAmount={(amount: string) => setCollateral(Decimal.from(amount))}
          tokenPrice={price}
        />

        <EditableRow
          label="Borrow"
          inputId="trove-borrow-amount"
          amount={borrowAmount.prettify()}
          unit={COIN}
          editingState={editingState}
          editedAmount={borrowAmount.toString(2)}
          setEditedAmount={(amount: string) => setBorrowAmount(Decimal.from(amount))}
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

        <CollateralRatio value={collateralRatio} />

        {description ?? (
          <ActionDescription>
            {`Start by entering the amount of ${collateralType.toUpperCase()} you'd like to deposit as collateral.`}
          </ActionDescription>
        )}

        <ExpensiveTroveChangeWarning
          asset={assetTokenAddress}
          troveChange={stableTroveChange}
          maxBorrowingRate={maxBorrowingRate}
          borrowingFeeDecayToleranceMinutes={60}
          gasEstimationState={gasEstimationState}
          setGasEstimationState={setGasEstimationState}
        />

        <Flex variant="layout.actions">
          <Button variant="cancel" sx={{ m: 3 }} onClick={handleCancelPressed}>
            Cancel
          </Button>

          {gasEstimationState.type === "inProgress" ? (
            <Button disabled sx={{ mb: 2 }}>
              <Spinner size="24px" sx={{ color: "background" }} />
            </Button>
          ) : stableTroveChange ? (
            <TroveAction
              transactionId={TRANSACTION_ID}
              change={stableTroveChange}
              asset={assetTokenAddress}
              maxBorrowingRate={maxBorrowingRate}
              borrowingFeeDecayToleranceMinutes={60}
            >
              Confirm
            </TroveAction>
          ) : (
            <Button disabled sx={{ mb: 2 }}>Confirm</Button>
          )}
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
