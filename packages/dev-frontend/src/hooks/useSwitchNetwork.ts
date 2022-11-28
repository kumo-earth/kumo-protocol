import { useState, useEffect } from "react";
import { useWeb3React } from "@web3-react/core";
import { useSwitchNetworkView } from "../components/SwitchNetwork/context/SwitchNetworkViewContext";

export function useSwitchNetwork(): {
  networkSwitched: boolean;
  switchNetwork: (provider: any, walletConnector: any) => void;
} {
  const {
    library: provider,
    activate,
    active,
    connector,
    deactivate,
    error
  } = useWeb3React<any>();
  const { dispatchEvent } = useSwitchNetworkView();
  const [networkSwitched, setNetworkSwitched] = useState(false);
  
  const chainId: number = Number(process.env.REACT_APP_CHAIN_ID);
  const toHex = (num: number) => {
    const val = Number(num);
    return "0x" + val.toString(16);
  };

  const switchNetwork = async (provider: any, walletConnector?: typeof connector) => {
    if (typeof provider !== "undefined") {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHex(chainId) }]
        });
        if (walletConnector) {
          activate(walletConnector).catch(error => {
            console.log(error);
          });
        }
      } catch (switchError: any) {
        if (switchError && switchError.code === 4902) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainName: `${process.env.REACT_APP_CHAIN_NAME}` ,
                  chainId: toHex(chainId),
                  nativeCurrency: { name: `${process.env.REACT_APP_CURRENCY_NAME}`, decimals: 18, symbol: `${process.env.REACT_APP_CURRENCY_SYMBOL}` },
                  rpcUrls: [
                    `${process.env.REACT_APP_RPC_URL}`
                  ]
                }
              ]
            });
            if (walletConnector) {
              activate(walletConnector).catch(error => {
                console.log(error);
              });
            }
          } catch (error) {
            console.log(error);
          }
        }
      }
    }
  };

  useEffect(() => {
    const handleSwitch = async () => {
      if (error?.name === "UnsupportedChainIdError") {
        sessionStorage.removeItem("account");
        deactivate();
        dispatchEvent("OPEN_MODAL_PRESSED");
      }
    };
   

    handleSwitch();
  }, [provider, connector, error?.name]);

  useEffect(() => {
    if (active) {
      setNetworkSwitched(true);
    } else {
      setNetworkSwitched(false);
    }
  }, [active]);
  return { networkSwitched, switchNetwork };
}
