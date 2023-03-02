import React from "react";
import { Heading, Box, Card } from "theme-ui";

import {
  Difference,
  Decimalish,
  Decimal,
  Trove,
  KumoStoreState,
  KUSD_LIQUIDATION_RESERVE,
  Vault,
} from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { COIN } from "../../strings";

import { StaticRow } from "./Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";
import { InfoIcon } from "../InfoIcon";
import { useParams } from "react-router-dom";

type TroveEditorProps = {
  original: Trove;
  edited: Trove;
  fee: Decimal;
  borrowingRate: Decimal;
  changePending: boolean;
  dispatch: (
    action: { type: "setCollateral" | "setDebt"; newValue: Decimalish } | { type: "revert" }
  ) => void;
};

const select = ({ vaults }: KumoStoreState) => ({ vaults });

export const TroveEditor: React.FC<TroveEditorProps> = ({
  children,
  original,
  edited,
  changePending
}) => {
  const { vaults } = useKumoSelector(select);

  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault;
  const price = vault?.price;

  const originalCollateralRatio = !original.isEmpty ? original.collateralRatio(price) : undefined;
  const collateralRatio = !edited.isEmpty ? edited.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, originalCollateralRatio);

  return (
    <Card
      variant="base"
      sx={{
        width: "90%"
      }}
    >
      <Heading>{collateralType?.toUpperCase()} Vault</Heading>

      <Box sx={{ p: [2, 3] }}>
        <StaticRow
          label="Collateral"
          inputId="trove-collateral"
          amount={original.collateral.prettify(0)}
          unit={collateralType?.toUpperCase()}
        />

        <StaticRow label="Debt" inputId="trove-debt" amount={original.netDebt.prettify(0)} unit={COIN} />

        {original.isEmpty && (
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
                    liquidated. The amount increases your debt and is refunded if you close your
                    Vault by fully paying off its net debt.
                  </Card>
                }
              />
            }
          />
        )}

        {/* <StaticRow
          label="Borrowing Fee"
          inputId="trove-borrowing-fee"
          amount={fee.toString(2)}
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
        /> */}

        <CollateralRatio value={originalCollateralRatio} change={collateralRatioChange} />

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
