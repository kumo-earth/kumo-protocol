import {
  Decimal,
  StabilityDeposit,
  StabilityDepositChange,
  UserTrove
} from "@kumodao/lib-base";

import { COIN } from "../../../strings";
import { Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";
import { StabilityActionDescription } from "../StabilityActionDescription";

type SelectForStabilityDepositChangeValidationType = {
  trove: UserTrove;
  kusdBalance: Decimal;
  haveUndercollateralizedTroves: boolean;
}

type StabilityDepositChangeValidationContext = SelectForStabilityDepositChangeValidationType;

export const validateStabilityDepositChange = (
  collateralType: string,
  originalDeposit: StabilityDeposit,
  editedKUSD: Decimal,
  {
    kusdBalance,
    haveUndercollateralizedTroves
  }: StabilityDepositChangeValidationContext
): [
    validChange: StabilityDepositChange<Decimal> | undefined,
    description: JSX.Element | undefined
  ] => {
  const change = originalDeposit.whatChanged(editedKUSD);

  if (!change) {
    return [undefined, undefined];
  }

  if (change.depositKUSD?.gt(kusdBalance)) {
    return [
      undefined,
      <ErrorDescription>
        The amount you're trying to deposit exceeds your balance by{" "}
        <Amount>
          {change.depositKUSD.sub(kusdBalance).prettify(0)} {COIN}
        </Amount>
        .
      </ErrorDescription>
    ];
  }

  if (change.withdrawKUSD && haveUndercollateralizedTroves) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to withdraw KUSD from your Stability Deposit when there are
        undercollateralized Vaults. Please liquidate those Vaults or try again later.
      </ErrorDescription>
    ];
  }

  return [change, <StabilityActionDescription collateralType={collateralType} originalDeposit={originalDeposit} change={change} />];
};
