import { InjectedConnector } from "@web3-react/injected-connector";
import { NetworkConnector } from "@web3-react/network-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";

export const injectedConnector = new InjectedConnector({
  supportedChainIds: [80001]
});

export const networkConnector = new NetworkConnector({
  urls: { 80001: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API}` },
  defaultChainId: 80001
});

export const WalletConnect = new WalletConnectConnector({
  rpc: { 80001: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API}` },
  bridge: "https://bridge.walletconnect.org",
  qrcode: true,
});
