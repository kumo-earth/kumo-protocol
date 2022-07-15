import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import {
  Decimal,
  UserTrove
} from "@kumodao/lib-base";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { useDashboard } from "../../hooks/DashboardContext";
import { RemainingKUMO } from "./RemainingKUMO";
import { Yield } from "./Yield";

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();
  const { account } = useWeb3React<Web3Provider>();
  const location = useLocation();
  const { vaults } = useDashboard();
  const vaultType = vaults.find(vault => vault.type === getPathName(location)) || vaults[0];
  const trove =
    vaultType.usersTroves.find(userT => userT.ownerAddress === account) ||
    new UserTrove(account || "0x0", "nonExistent", Decimal.ZERO, Decimal.ZERO);
  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
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
        borderRadius: "20px"
      }}
    >
      <Heading
        sx={{
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          color: "white"
        }}
      >
        {getPathName(location).toUpperCase()} Stability Pool
        {/* <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingKUMO />
        </Flex> */}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no KUSD in the Stability Pool.">
          You can earn {getPathName(location).toUpperCase()} and KUMO rewards by depositing KUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
          <Button
            onClick={handleOpenTrove}
            sx={{
              backgroundColor: "rgb(152, 80, 90)",
              boxShadow:
                "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
              border: "none",
              color: "white"
            }}
            disabled={trove.status === "nonExistent"}
          >
            Deposit
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
