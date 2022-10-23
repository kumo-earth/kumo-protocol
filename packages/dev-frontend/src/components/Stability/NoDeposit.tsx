import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { Decimal, UserTrove } from "@kumodao/lib-base";
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
    <Card variant="base" sx={{ background: '#ebd8df' }}>
      <Heading>
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
            disabled={trove.status === "nonExistent"}
          >
            Deposit
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
