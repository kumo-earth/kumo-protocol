import React, { useCallback } from "react";
import { useHistory } from "react-router-dom";
import { Card, Heading, Box } from "theme-ui";
import { Vault } from "@kumodao/lib-base";
import { DisabledEditableRow } from "./Editor";
import { useTroveView } from "./context/TroveViewContext";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";


export const PortfolioTrove: React.FC<{ vault: Vault }> = ({ vault = new Vault }) => {
  const history = useHistory()

  const { trove } = vault;
  const price = vault?.price
  let collateralRatio = trove?.collateralRatio(price);

  // console.log("READONLY TROVE", trove.collateral.prettify(4));
  return (
    <Card variant="portfolioCard" onClick={() => history.push(`/dashboard/${vault?.asset}`)}>
      <Heading as="h2">{vault?.asset.toUpperCase()} Vault</Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Collateral"
            inputId="trove-collateral"
            amount={trove?.collateral.prettify(0) || "0"}
            unit={vault?.asset?.toUpperCase()}
          />

          <DisabledEditableRow
            label="Debt"
            inputId="trove-debt"
            amount={trove?.debt.prettify(0) || "0"}
            unit={COIN}
          />

          <CollateralRatio value={collateralRatio} />
        </Box>
      </Box>
    </Card>
  );
};
