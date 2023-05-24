import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { useMyTransactionState } from "./Transaction";
import { useTroveView } from "./Trove/context/TroveViewContext";

export const CollateralSurplusAction: React.FC<{ asset?: string }> = () => {

  const myTransactionId = "claim-coll-surplus";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const { dispatchEvent } = useTroveView();

  useEffect(() => {
    if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_SURPLUS_COLLATERAL_CLAIMED");
    }
  }, [myTransactionState.type, dispatchEvent]);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }} variant={'primaryInActive'}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : myTransactionState.type !== "waitingForConfirmation" &&
    myTransactionState.type !== "confirmed" ? (
    <Flex variant="layout.actions">
      {/* <Transaction
        id={myTransactionId}
        send={kumo.claimCollateralSurplus.bind(kumo, asset, undefined)}
      >
        <Button sx={{ mx: 2 }}>Claim {collateralSurplusBalance.prettify()} ETH</Button>
      </Transaction> */}
    </Flex>
  ) : null;
};
