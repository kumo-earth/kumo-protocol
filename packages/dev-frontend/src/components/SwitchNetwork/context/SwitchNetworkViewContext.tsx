import { createContext, useContext } from "react";
import type { SwitchNetworkView, SwitchNetworkEvent } from "./types";

type SwitchNetworkViewContextType = {
  view: SwitchNetworkView;
  dispatchEvent: (event: SwitchNetworkEvent) => void;
};

export const SwitchNetworkViewContext = createContext<SwitchNetworkViewContextType | null>(null);

export const useSwitchNetworkView = (): SwitchNetworkViewContextType => {
  const context: SwitchNetworkViewContextType | null = useContext(SwitchNetworkViewContext);

  if (context === null) {
    throw new Error("You must add a <WalletViewProvider> into the React tree");
  }

  return context;
};
