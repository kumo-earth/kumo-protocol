import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { DisabledEditableRow } from "./Editor";
import { useTroveView } from "./context/TroveViewContext";
import { Icon } from "../Icon";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";
import { useDashboard } from "../../hooks/DashboardContext";


const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const ReadOnlyTrove: React.FC = () => {
  const { dispatchEvent } = useTroveView();
  const handleAdjustTrove = useCallback(() => {
    dispatchEvent("ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);
  const handleCloseTrove = useCallback(() => {
    dispatchEvent("CLOSE_TROVE_PRESSED");
  }, [dispatchEvent]);

  const location = useLocation();
  const { vaults } = useDashboard();
  const vaultType = vaults.find(vault => vault.type === getPathName(location)) ?? vaults[0];
  const { trove } = vaultType;
  // console.log("READONLY TROVE", trove.collateral.prettify(4));
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
        color: "white",
        m: "0 !important"
      }}
    >
      <Heading
        sx={{
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          color: "white"
        }}
      >
        {vaultType.type.toUpperCase()} Trove
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Collateral"
            inputId="trove-collateral"
            amount={trove.collateral.prettify(4)}
            unit={getPathName(location).toUpperCase()}
          />

          <DisabledEditableRow
            label="Debt"
            inputId="trove-debt"
            amount={trove.debt.prettify()}
            unit={COIN}
          />

          <CollateralRatio value={vaultType.collateralRatio} />
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant="outline"
            onClick={handleCloseTrove}
            sx={{
              backgroundColor: "rgb(152, 80, 90)",
              boxShadow:
                "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
              border: "none",
              color: "white"
            }}
          >
            Close Trove
          </Button>
          <Button
            onClick={handleAdjustTrove}
            sx={{
              backgroundColor: "rgb(152, 80, 90)",
              boxShadow:
                "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
              border: "none"
            }}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
