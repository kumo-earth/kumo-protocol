import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { Decimal } from "@kumodao/lib-base";
import { DisabledEditableRow } from "./Editor";
import { useTroveView } from "./context/TroveViewContext";
import { Icon } from "../Icon";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";
import { useDashboard } from "../../hooks/DashboardContext";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

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

  const { account } = useWeb3React<Web3Provider>();

  const location = useLocation();
  const { vaults, bctPrice, mco2Price } = useDashboard();
  const vaultType = vaults.find(vault => vault.type === getPathName(location)) ?? vaults[0];
  const trove = vaultType.usersTroves.find(userT => userT.ownerAddress === account);
  let collateralRatio: Decimal | undefined = undefined;
  if (getPathName(location) === "bct") {
    collateralRatio = trove?.collateralRatio(bctPrice) || undefined;
  } else if (getPathName(location) === "mco2") {
    collateralRatio = trove?.collateralRatio(mco2Price) || undefined;
  }
  let unit = ((getPathName(location) === "bct" && "Carbon Token X") || (getPathName(location) === "mco2" && "Biodiversity Token Y")) || ""
  // console.log("READONLY TROVE", trove.collateral.prettify(4));
  return (
    <Card
      variant="base"
    >
      <Heading>
        {unit.toUpperCase()} <span style={{ marginLeft: "22px" }}>Trove</span>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Collateral"
            inputId="trove-collateral"
            amount={trove?.collateral.prettify(4) || "0"}
            unit={unit.toUpperCase()}
          />

          <DisabledEditableRow
            label="Debt"
            inputId="trove-debt"
            amount={trove?.debt.prettify() || "0"}
            unit={COIN}
          />

          <CollateralRatio value={collateralRatio} />
        </Box>

        <Flex variant="layout.actions">
          <Button
            // variant="outline"
            onClick={handleCloseTrove}
            // sx={{
            //   border: "none",
            // }}
          >
            Close Trove
          </Button>
          <Button
            onClick={handleAdjustTrove}
            sx={{
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
