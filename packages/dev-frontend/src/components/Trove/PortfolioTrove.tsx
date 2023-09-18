import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Heading, Box, Text } from "theme-ui";
import { Vault } from "@kumodao/lib-base";
import { DisabledEditableRow } from "./Editor";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";


export const PortfolioTrove: React.FC<{ vault: Vault }> = ({ vault = new Vault() }) => {
  const navigate = useNavigate()

  const { trove } = vault;
  const price = vault?.price
  let collateralRatio = trove?.collateralRatio(price);

  // console.log("READONLY TROVE", trove.collateral.prettify(4));
  return (
    <Card variant="portfolioCard" onClick={() => navigate(`/dashboard/${vault?.asset}`)}>
      <Heading as="h2">{vault?.asset.toUpperCase()} Vault <Text variant="assetName">({vault.assetName})</Text></Heading>
      <Box sx={{ py: 4, px: 5 }}>
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
