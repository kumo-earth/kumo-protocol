import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { Icon } from "../Icon";
import { InfoMessage } from "../InfoMessage";
import { useTroveView } from "./context/TroveViewContext";

export const NoTrove: React.FC = props => {
  const { dispatchEvent } = useTroveView();
  const { collateralType } = useParams<{ collateralType: string }>();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card variant="base" sx={{ width: "100%" }}>
      <Heading as="h2">{collateralType?.toUpperCase()} Vault</Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You haven't borrowed any KUSD yet.">
          You can borrow KUSD by opening a Vault.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button sx={{ mt: 3, mb: 2 }} onClick={handleOpenTrove}>
            OPEN VAULT
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
