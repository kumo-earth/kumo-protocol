import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";

export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card  sx={{
      background: "rgba(249,248,249,.1)",
      backgroundColor: "#303553",
      // color: "rgba(0, 0, 0, 0.87)",
      transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      boxShadow:
        "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)",
      overflow: "hidden",
      borderRadius: "20px"
    }}>
      <Heading sx={{
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          color: "white"
        }}>
        Stability Pool
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no LUSD in the Stability Pool.">
          You can earn ETH and LQTY rewards by depositing LUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
          <Button onClick={handleOpenTrove} sx={{
            backgroundColor: "rgb(152, 80, 90)",
            boxShadow:
              "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
            border: "none",
            color: "white",
          }}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  );
};
