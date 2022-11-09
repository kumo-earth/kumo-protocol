import { useEffect } from "react";
import { useSwitchNetwork } from "../../hooks/useSwitchNetwork";

import { useSwitchNetworkView } from "./context/SwitchNetworkViewContext";
import { Card, Box, Heading, Button } from "theme-ui";
import { useDialogState, Dialog } from "reakit/Dialog";
import {
  injectedConnector,
} from "../../connectors/injectedConnector";

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
        <Card
          // sx={{
          //   background: "rgba(249,248,249,.1)",
          //   backgroundColor: "#303553",
          //   // color: "rgba(0, 0, 0, 0.87)",
          //   transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
          //   boxShadow:
          //     "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)",
          //   overflow: "hidden",
          //   borderRadius: "20px"
          // }}
          variant="base"
          sx={{
            background: '#f0cfdc'
          }}
        >
          <Heading
            sx={{
              display: "flex",
              background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
              color: "white"
            }}
          >
            Connect to Wallet{" "}
            <span
              style={{ marginLeft: "auto" }}
              onClick={() => dispatchEvent("CLOSE_MODAL_PRESSED")}
            >
              Close
            </span>
          </Heading>
          <Box sx={{ p: [4, 3], display: "flex", justifyContent: "center" }}>
            <Button
              onClick={async e => {
                const injP = await injectedConnector.getProvider();
                if (injP) {
                  switchNetwork(injP, injectedConnector);
                }
                dispatchEvent("CLOSE_MODAL_PRESSED");
                e.stopPropagation();
              }}
              // sx={{
              //   width: 200,
              //   backgroundColor: "rgb(47, 52, 81)",
              //   borderRadius: 8,
              //   outline: "none"
              // }}
            >
              <Box sx={{ ml: 2 }}>Switch to Polygon Test</Box>
            </Button>
          </Box>
        </Card>
      </Box>
    </Dialog>
  );
};
