import React, { useCallback } from "react";
import { Card, Heading, Box, Button, Flex } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useTroveView } from "./context/TroveViewContext";
import { InfoMessage } from "../InfoMessage";

const select = ({ collateralSurplusBalance }: KumoStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero
});

export const LiquidatedTrove: React.FC = () => {
  const { hasSurplusCollateral } = useKumoSelector(select);
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card
      sx={{
        background: "rgba(249,248,249,.1)",
        backgroundColor: "#303553",
        // color: "rgba(0, 0, 0, 0.87)",
        transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        boxShadow:
          "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)",
        overflow: "hidden",
        borderRadius: "20px",
        width: "100%",
        color: "white"
      }}
    >
      <Heading
        sx={{
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          color: "white"
        }}
      >
        Trove
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Your Trove has been liquidated.">
          {hasSurplusCollateral
            ? "Please reclaim your remaining collateral before opening a new Trove."
            : "You can borrow KUSD by opening a Trove."}
        </InfoMessage>

        <Flex variant="layout.actions">
          {hasSurplusCollateral && <CollateralSurplusAction />}
          {!hasSurplusCollateral && (
            <Button
              sx={{
                backgroundColor: "rgb(152, 80, 90)",
                boxShadow:
                  "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
                border: "none",
                color: "white"
              }}
              onClick={handleOpenTrove}
            >
              Open Trove
            </Button>
          )}
        </Flex>
      </Box>
    </Card>
  );
};
