import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingKUMO } from "./RemainingKUMO";
import { Yield } from "./Yield";

export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Stability Pool
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingKUMO />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no KUSD in the Stability Pool.">
          You can earn ETH and KUMO rewards by depositing KUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
          <Button onClick={handleOpenTrove}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  );
};
