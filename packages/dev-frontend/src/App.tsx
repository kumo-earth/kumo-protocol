import React, { ReactNode } from "react";
import { Web3ReactProvider } from "@web3-react/core";
import { Flex, Spinner, Heading, ThemeUIProvider, Paragraph, Link } from "theme-ui";

import { BatchedWebSocketAugmentedWeb3Provider } from "@kumodao/providers";
import { KumoProvider } from "./hooks/KumoContext";
import { TransactionProvider } from "./components/Transaction";
import { Icon } from "./components/Icon";
import { getConfig } from "./config";
import theme from "./theme";

import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";
import { KumoFrontend } from "./KumoFrontend";
import { WalletViewProvider } from "./components/WalletConnect/context/WalletViewProvider";
import { SwitchNetworkViewProvider } from "./components/SwitchNetwork/context/SwitchNetworkViewProvider";
import { BrowserRouter } from "react-router-dom";
import { AddAssetViewProvider } from "./components/AddAssetToken/context/AssetViewProvider";

if (window.ethereum) {
  // Silence MetaMask warning in console
  Object.assign(window.ethereum, { autoRefreshOnNetworkChange: false });
}

if (import.meta.env.VITE_DEMO_MODE === "true") {
  const ethereum = new DisposableWalletProvider(
    `http://${window.location.hostname}:8545`,
    "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
  );

  Object.assign(window, { ethereum });
}

// Start pre-fetching the config
getConfig().then(config => {
  // console.log("Frontend config:");
  // console.log(config);
  Object.assign(window, { config });
});

const EthersWeb3ReactProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={provider => new BatchedWebSocketAugmentedWeb3Provider(provider)}>
      {children}
    </Web3ReactProvider>
  );
};

const UnsupportedMainnetFallback: React.FC = () => (
  <Flex
    sx={{
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      textAlign: "center"
    }}
  >
    <Heading sx={{ mb: 3 }}>
      <Icon name="exclamation-triangle" /> This app is for testing purposes only.
    </Heading>

    <Paragraph sx={{ mb: 3 }}>Please change your network to Mumbai.</Paragraph>

    <Paragraph>
      If you'd like to use the Kumo Protocol on mainnet, please pick a frontend{" "}
      <Link href="https://kumo.earth/">
        here <Icon name="external-link-alt" size="xs" />
      </Link>
      .
    </Paragraph>
  </Flex>
);

const App = () => {
  const loader = (
    <Flex sx={{ alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Spinner sx={{ m: 2, color: "text" }} size={32} />
      <Heading>Loading...</Heading>
    </Flex>
  );

  const unsupportedNetworkFallback = (chainId: number) => (
    <Flex
      sx={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center"
      }}
    >
      <Heading sx={{ mb: 3 }}>
        <Icon name="exclamation-triangle" /> Kumo is not yet deployed to{" "}
        {chainId === 1 ? "mainnet" : "this network"}.
      </Heading>
      Please switch to Mumbai.
    </Flex>
  );

  return (
    <BrowserRouter>
      <EthersWeb3ReactProvider>
        <ThemeUIProvider theme={theme}>
          <WalletViewProvider>
            <SwitchNetworkViewProvider>
              <AddAssetViewProvider>
                {/* <WalletConnector loader={loader}> */}
                <KumoProvider
                  loader={loader}
                  unsupportedNetworkFallback={unsupportedNetworkFallback}
                  unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
                >
                  <TransactionProvider>
                    <KumoFrontend loader={loader} />
                  </TransactionProvider>
                </KumoProvider>
              </AddAssetViewProvider>
            </SwitchNetworkViewProvider>
            {/* </WalletConnector> */}
          </WalletViewProvider>
        </ThemeUIProvider>
      </EthersWeb3ReactProvider>
    </BrowserRouter>
  );
};

export default App;
