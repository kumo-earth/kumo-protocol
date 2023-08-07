import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthorizedConnection } from "../hooks/useAuthorizedConnection";
import { networkConnector } from "../connectors/injectedConnector";
import { BatchedWebSocketAugmentedWeb3Provider } from "@kumodao/providers";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";
import { useSwitchNetwork } from "./useSwitchNetwork";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@kumodao/providers";
import {
  BlockPolledKumoStore,
  EthersKumo,
  EthersKumoWithStore,
  _connectByChainId
} from "@kumodao/lib-ethers";
import { KumoFrontendConfig, getConfig } from "../config";

type KumoContextValue =
  | {
    config: KumoFrontendConfig;
    kumo: EthersKumoWithStore<BlockPolledKumoStore>;
    provider: Provider;
    account: string;
  }
  | {
    config: KumoFrontendConfig;
    kumo: EthersKumoWithStore<BlockPolledKumoStore>;
    provider: Provider;
  };

const KumoContext = createContext<KumoContextValue | undefined>(undefined);

type KumoProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
};

const supportedNetworks = ["homestead", "maticmum"];

export const KumoProvider: React.FC<KumoProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const { networkSwitched } = useSwitchNetwork();

  const [readprovider, setReadProvider] = useState<{
    provider: any;
    chainId: number;
  }>();
  const [config, setConfig] = useState<KumoFrontendConfig>();
  const triedAuthorizedConnection = useAuthorizedConnection();

  const connection = useMemo(() => {
    if (config && provider && account && chainId) {
      sessionStorage.setItem("account", account);
      return _connectByChainId(
        provider,
        chainId,
        {
          userAddress: account,
          useStore: "blockPolled"
        },
        provider.getSigner(account)
      );
    } else if (config && readprovider?.provider && readprovider?.chainId) {
      return _connectByChainId(readprovider.provider, readprovider.chainId, {
        // userAddress: account,
        useStore: "blockPolled"
      });
    }
  }, [config, provider, account, chainId, readprovider]);

  const handleReadConnector = async () => {
    if (!account && !provider) {
      try {
        let networkConnect = await networkConnector.activate();
        const networkChaindId = networkConnect.chainId;
        const networkProviderSocketProvider = new BatchedWebSocketAugmentedWeb3Provider(
          networkConnect?.provider
        );

        if (typeof networkChaindId !== "undefined" && typeof networkChaindId !== "string") {
          setReadProvider({ provider: networkProviderSocketProvider, chainId: networkChaindId });
        }
      } catch (error) {
        console.log(error);
      }
    }
  };

  useEffect(() => {
    console.log(networkSwitched, triedAuthorizedConnection);
    getConfig().then(setConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!account) {
      handleReadConnector();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    if (!sessionStorage.getItem("account")) {
      handleReadConnector();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStorage.getItem("account")]);

  useEffect(() => {
    if (config && connection && account) {
      const { provider, chainId } = connection;
      if (isBatchedProvider(provider) && provider.chainId !== chainId) {
        provider.chainId = chainId;
      }

      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);
        if (
          network.name &&
          supportedNetworks.includes(network.name) &&
          config.alchemyApiKey &&
          account
        ) {
          provider.openWebSocket(`${process.env.REACT_APP_WSS_URL}`, chainId);
        } else if (connection._isDev) {
          provider.openWebSocket(`${process.env.REACT_APP_WSS_URL}`, chainId);
        }
        return () => {
          provider.closeWebSocket();
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, connection, account]);

  if (config?.testnetOnly && chainId === 1) {
    return <>{unsupportedMainnetFallback}</>;
  }

  if (!connection) {
    if (unsupportedNetworkFallback && chainId && readprovider?.chainId) {
      return (
        <>
          {account && chainId
            ? unsupportedNetworkFallback(chainId)
            : readprovider && unsupportedNetworkFallback(readprovider.chainId)}
        </>
      );
    } else {
      return <>{loader}</>;
    }
  }

  const kumo = EthersKumo._from(connection);
  kumo.store.logging = true;

  return (
    <KumoContext.Provider
      value={
        config && provider && account
          ? { config, kumo, provider, account }
          : config && readprovider?.provider && { config, kumo, provider: readprovider.provider }
      }
    >
      {children}
    </KumoContext.Provider>
  );
};

export const useKumo = () => {
  const kumoContext = useContext(KumoContext);

  if (!kumoContext) {
    throw new Error("You must provide a KumoContext via KumoProvider");
  }

  return kumoContext;
};
