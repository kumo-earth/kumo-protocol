import React from "react";
import { useSwitchNetwork } from "../../hooks/useSwitchNetwork";

import { useSwitchNetworkView } from "./context/SwitchNetworkViewContext";
import { Card, Box, Heading, Button } from "theme-ui";
import { injectedConnector } from "../../connectors/injectedConnector";
import { Icon } from "../Icon";

export const SwitchNetworkModal: React.FC = () => {
  const { dispatchEvent } = useSwitchNetworkView();
  const { switchNetwork } = useSwitchNetwork();


  return (
    <Card variant="modalCard">
      <Heading as={"h2"} sx={{ mr: 2 }}>
        Connect to Wallet{" "}
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={() => dispatchEvent("CLOSE_SWITCH_MODAL_PRESSED")}
        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      <Box sx={{ p: [4, 3], my: 3, display: "flex", justifyContent: "center" }}>
        <Button
          onClick={async e => {
            const injP = await injectedConnector.getProvider();
            if (injP) {
              switchNetwork(injP, injectedConnector);
            }
            dispatchEvent("CLOSE_SWITCH_MODAL_PRESSED");
            e.stopPropagation();
          }}
          sx={{
            outline: "none"
          }}
        >
          <Box sx={{ ml: 2 }}>
            {process.env.NODE_ENV === "development"
              ? "SWITCH to LOCALHOST"
              : "SWITCH to POLYGON TEST"}
          </Box>
        </Button>
      </Box>
    </Card>
  );
};
