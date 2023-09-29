import { InjectedConnector } from "@web3-react/injected-connector";
import { NetworkConnector } from "@web3-react/network-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
const chainId: number = Number(import.meta.env.VITE_CHAIN_ID);

export const injectedConnector = new InjectedConnector({
  supportedChainIds: [chainId]
});

export const networkConnector = new NetworkConnector({
  urls: { [chainId]: `${import.meta.env.VITE_RPC_URL}` },
  defaultChainId: chainId
});

export const WalletConnect = new WalletConnectConnector({
  rpc: { [chainId]: `${import.meta.env.VITE_RPC_URL}` },
  bridge: "https://bridge.walletconnect.org",
  qrcode: true
});
