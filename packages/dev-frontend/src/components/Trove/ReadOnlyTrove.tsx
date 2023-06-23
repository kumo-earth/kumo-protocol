import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, Heading, Box, Flex, Button, Text } from "theme-ui";
import { KumoStoreState, Vault } from "@kumodao/lib-base";
import { DisabledEditableRow } from "./Editor";
import { useTroveView } from "./context/TroveViewContext";
import { Icon } from "../Icon";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";
import { useKumoSelector } from "@kumodao/lib-react";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const ReadOnlyTrove: React.FC = () => {
  const { dispatchEvent } = useTroveView();
  const handleAdjustTrove = useCallback(() => {
    dispatchEvent("ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);
  const handleCloseTrove = useCallback(() => {
    dispatchEvent("CLOSE_TROVE_PRESSED");
  }, [dispatchEvent]);

  const { collateralType } = useParams<{ collateralType: string }>();
  const { vaults } = useKumoSelector(select);
  const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault();
  const { trove } = vault;
  const price = vault?.price
  let collateralRatio = trove?.collateralRatio(price);

  // console.log("READONLY TROVE", trove.collateral.prettify(4));

  return (
    <Card variant="base">
      <Heading as="h2">{vault?.asset.toUpperCase()} Vault <Text variant="assetName">({vault.assetName})</Text></Heading>
      <Box sx={{ py: 4, px: [3, 5] }}>
        <Box>
          <DisabledEditableRow
            label="Collateral"
            inputId="trove-collateral"
            amount={trove?.collateral.toString(0)}
            unit={collateralType?.toUpperCase()}
            tokenPrice={price}
          />

          <DisabledEditableRow
            label="Debt"
            inputId="trove-debt"
            amount={trove?.debt.prettify(2)}
            unit={COIN}
          />

          <CollateralRatio value={collateralRatio} />
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant="secondary"
            onClick={handleCloseTrove}
            sx={{
              mt: 3,
              mb: 2
            }}
          >
            CLOSE VAULT
          </Button>
          <Button
            onClick={handleAdjustTrove}
          >
            <Icon name="pen" size="sm" />
            &nbsp;ADJUST
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
