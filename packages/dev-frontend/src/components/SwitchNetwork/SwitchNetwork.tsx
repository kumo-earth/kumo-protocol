import { useEffect } from "react";
import { useSwitchNetwork } from "../../hooks/useSwitchNetwork";

import { useSwitchNetworkView } from "./context/SwitchNetworkViewContext";
import { Card, Box, Heading, Button } from "theme-ui";
import { useDialogState, Dialog } from "reakit/Dialog";
import { injectedConnector } from "../../connectors/injectedConnector";
import { Icon } from "../Icon";

export const SwitchNetworkModal: React.FC = () => {
  const { dispatchEvent } = useSwitchNetworkView();
  const { switchNetwork } = useSwitchNetwork();
  const dialog = useDialogState();

  useEffect(() => {
    dialog.setVisible(true);
  }, []);

  // useEffect(() => {
  //   return () => {
  //     if (dialog.visible) {
  //       dispatchEvent("CLOSE_MODAL_PRESSED");
  //     }
  //   };
  // });

  const style = {
    top: "45%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 470,
    bgcolor: "background.paper",
    border: "none",
    boxShadow: 24,
    p: 0
  };
  return (
    <Dialog {...dialog} hideOnClickOutside={false}>
      <Box sx={{ ...style, position: "absolute" }}>
        <Card variant="base" sx={{ background: "#ebd8df" }}>
          <Heading as={"h2"} sx={{ mr: 2 }}>
            Connect to Wallet{" "}
            <span
              style={{ marginLeft: "auto", cursor: "pointer" }}
              onClick={() => dispatchEvent("CLOSE_MODAL_PRESSED")}
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
                dispatchEvent("CLOSE_MODAL_PRESSED");
                e.stopPropagation();
              }}
              sx={{
                borderRadius: 8,
                outline: "none"
              }}
            >
              <Box sx={{ ml: 2 }}>
                {process.env.NODE_ENV === "development"
                  ? "Switch to Localhost"
                  : "Switch to Polygon Test"}
              </Box>
            </Button>
          </Box>
        </Card>
      </Box>
    </Dialog>
  );
};
