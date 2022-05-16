import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@kumodao/providers";
import {
  BlockPolledKumoStore,
  EthersKumo,
  EthersKumoWithStore,
  _connectByChainId
} from "@kumodao/lib-ethers";

import { KumoFrontendConfig, getConfig } from "../config";

type KumoContextValue = {
  config: KumoFrontendConfig;
  account: string;
  provider: Provider;
  liquity: EthersKumoWithStore<BlockPolledKumoStore>;
};

const KumoContext = createContext<KumoContextValue | undefined>(undefined);

type KumoProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network === "homestead" ? "mainnet" : network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

const supportedNetworks = ["homestead", "kovan", "rinkeby", "ropsten", "goerli", "mumbai"];

export const KumoProvider: React.FC<KumoProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const [config, setConfig] = useState<KumoFrontendConfig>();

  const connection = useMemo(() => {
    if (config && provider && account && chainId) {
      console.log("connection1", config, provider, account, chainId)
      try {
        return _connectByChainId(provider, provider.getSigner(account), chainId, {
          userAddress: account,
          frontendTag: config.frontendTag,
          useStore: "blockPolled"
        });
      } catch(error) {
        console.log("connection1Error", error)
      }
    }
  }, [config, provider, account, chainId]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    console.log("connection", connection)
    if (config && connection) {
      const { provider, chainId } = connection;

      

      if (isBatchedProvider(provider) && provider.chainId !== chainId) {
        provider.chainId = chainId;
      }

      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);

        if (network.name && supportedNetworks.includes(network.name) && config.infuraApiKey) {
          provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
        } else if (connection._isDev) {
          provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
        }

        return () => {
          provider.closeWebSocket();
        };
      }
    }
  }, [config, connection]);

  if (!config || !provider || !account || !chainId) {
    return <>{loader}</>;
  }

  if (config.testnetOnly && chainId === 1) {
    return <>{unsupportedMainnetFallback}</>;
  }

  if (!connection) {
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : null;
  }

  const liquity = EthersKumo._from(connection);
  liquity.store.logging = true;

  return (
    <KumoContext.Provider value={{ config, account, provider, liquity }}>
      {children}
    </KumoContext.Provider>
  );
};

export const useKumo = () => {
  const liquityContext = useContext(KumoContext);

  if (!liquityContext) {
    throw new Error("You must provide a KumoContext via KumoProvider");
  }

  return liquityContext;
};