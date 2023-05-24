import React, { useEffect } from "react";
import { useWeb3React } from "@web3-react/core";
import { Card, Box, Heading, Button, Text } from "theme-ui";
import { useDialogState } from "reakit/Dialog";

import { useSwitchNetwork } from "../../hooks/useSwitchNetwork";
import { useWalletView } from "./context/WalletViewContext";
import { detectMob } from "../../utils/detectMob";

import { injectedConnector, WalletConnect } from "../../connectors/injectedConnector";
import { Icon } from "../Icon";
import { InfoIcon } from "../InfoIcon";

export const WalletModal: React.FC = () => {
  const { activate } = useWeb3React<unknown>();
  const { view, dispatchEvent } = useWalletView();
  const { switchNetwork } = useSwitchNetwork();
  const dialog = useDialogState();

  useEffect(() => {
    if (!dialog.visible && view !== "OPEN") {
      dispatchEvent("CLOSE_WALLET_MODAL_PRESSED");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog.visible]);

  return (
    <Card variant="modalCard">
      <Heading as="h2" sx={{ mr: 2 }}>
        Connect to Wallet{" "}
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={() => dispatchEvent("CLOSE_WALLET_MODAL_PRESSED")}
        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      {!(detectMob()) && <Box sx={{ p: [4, 3], mt: 3, display: "flex", justifyContent: "center" }}>
        <Button
          onClick={e => {
            activate(injectedConnector, undefined, true).catch(async error => {
              if (
                error?.name === "UnsupportedChainIdError" ||
                error?.message?.includes("Unsupported chain id")
              ) {
                try {
                  const metaMaaskProvider = await injectedConnector.getProvider();
                  if (metaMaaskProvider) {
                    switchNetwork(metaMaaskProvider, injectedConnector);
                  }
                } catch (error) {
                  console.log(error);
                }
              } else if (error.name === "NoEthereumProviderError" || error?.message?.includes("No Ethereum provider")) {
                alert("Please Intall MetaMask Extension");
              }
            });

            dispatchEvent("CLOSE_WALLET_MODAL_PRESSED");
            e.stopPropagation();
          }}
          sx={{
            width: 200,
            outline: "none"
          }}
        >
          <Box sx={{ ml: 2 }}>MetaMask</Box>
        </Button>
      </Box>
      }

      <Box sx={{ p: [4, 3], mb: [0, 3], display: "flex", justifyContent: "center" }}>
        <Button
          onClick={e => {
            activate(WalletConnect, undefined, true).catch(async error => {
              console.log(error)
            })
            dispatchEvent("CLOSE_WALLET_MODAL_PRESSED");
            e.stopPropagation();
          }}
          sx={{
            width: 200,
            outline: "none"
          }}
        >
          <Box sx={{ ml: 2 }}>WalletConnect</Box>
        </Button>

      </Box>
      {detectMob() &&
        <Box sx={{ ml: [3, 3], mb: 3, display: "flex", justifyContent: "center" }}>
          <Text sx={{ fontWeight: 500 }}>Please install MetaMask App and follow instructions <InfoIcon
            tooltip={
              <Card variant="tooltip" sx={{ maxWidth: "270px", wordBreak: 'break-word' }}>
                <Text sx={{ fontWeight: 'bold' }}>1: Add Network</Text>
                <br/>Network Name: <Text sx={{ fontWeight: 'bold' }}>{`${process.env.REACT_APP_CHAIN_NAME}`}</Text>
                <br/>New RPC URL: <Text sx={{ fontWeight: 'bold' }}>{`${process.env.REACT_APP_RPC_URL_WALLET}`}</Text>
                <br/>Chain ID: <Text sx={{ fontWeight: 'bold' }}>{`${process.env.REACT_APP_CHAIN_ID}`}</Text>
                <br/>Currency Symbol: <Text sx={{ fontWeight: 'bold' }}>{`${process.env.REACT_APP_CURRENCY_SYMBOL}`}</Text>
                <br/><Text sx={{ fontWeight: 'bold' }}>2: Import Account Using Provided Private key</Text>
                <br/><Text sx={{ fontWeight: 'bold' }}>3: Use In App MetaMask browser for better experience</Text>
                <br/><Text sx={{ fontWeight: 'bold' }}>4: If loading takes longer please wait, retry or reload page</Text><br/><br/>
              </Card>
            }
          /></Text>
        </Box>
      }
    </Card>
  );
};
