import React, { useCallback } from "react";
import { Card, Heading, Box, Button, Flex, Text } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { KumoStoreState, Vault } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useTroveView } from "./context/TroveViewContext";
import { InfoMessage } from "../InfoMessage";
import { useParams } from "react-router-dom";

export const RedeemedTrove: React.FC = () => {
  const { collateralType } = useParams<{ collateralType: string }>();

  const { hasSurplusCollateral, assetName } = useKumoSelector((state: KumoStoreState) => {
    const { vaults } = state;

    const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault();
    const { collateralSurplusBalance, assetName } = vault;
    return {
      hasSurplusCollateral: !collateralSurplusBalance.isZero,
      assetName
    };
  });
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card
      variant="base"
      sx={{
        width: "100%"
      }}
    >
      <Heading as="h2">{collateralType?.toUpperCase()} Vault <Text variant="assetName">({assetName})</Text></Heading>
      <Box sx={{ py: 4, px: [3, 5] }}>
        <InfoMessage title="Your Vault has been redeemed.">
          {hasSurplusCollateral
            ? "Please reclaim your remaining collateral before opening a new Vault."
            : "You can borrow KUSD by opening a Vault."}
        </InfoMessage>

        <Flex variant="layout.actions">
          {hasSurplusCollateral && <CollateralSurplusAction />}
          {!hasSurplusCollateral && <Button onClick={handleOpenTrove}>OPEN VAULT</Button>}
        </Flex>
      </Box>
    </Card>
  );
};
