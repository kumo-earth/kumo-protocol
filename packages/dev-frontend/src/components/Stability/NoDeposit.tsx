import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, Heading, Box, Flex, Button, Text } from "theme-ui";
import { useKumoSelector } from "@kumodao/lib-react";
import { Icon } from "../Icon";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { Yield } from "./Yield";
import { KumoStoreState, Vault } from "@kumodao/lib-base";

const select = ({
  vaults
}: KumoStoreState) => ({
  vaults
});

export const NoDeposit: React.FC = props => {
  const { vaults } = useKumoSelector(select);
  const { dispatchEvent } = useStabilityView();
  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vlt => vlt.asset === collateralType) ?? new Vault()
  const { assetName } = vault
  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card variant="modalCard">
      <Heading as="h2" sx={{ display: "flex", justifyContent: "space-between", mr: 2 }}>
        {collateralType?.toUpperCase()} Stability Pool <Text variant="assetName">({assetName})</Text>
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={() => dispatchEvent("CLOSE_MODAL_PRESSED")}

        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no KUSD in the Stability Pool.">
          You can earn {collateralType?.toUpperCase()} and KUMO rewards by depositing KUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
          <Button sx={{ mt: 3, mb: 2 }} onClick={handleOpenTrove}>DEPOSIT</Button>
        </Flex>
      </Box>
    </Card>
  );
};
