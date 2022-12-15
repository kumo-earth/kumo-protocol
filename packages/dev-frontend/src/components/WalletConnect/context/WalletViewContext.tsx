import { createContext, useContext } from "react";
import type { WalletView, WalletEvent } from "./types";

type WalletViewContextType = {
  view: WalletView;
  dispatchEvent: (event: WalletEvent) => void;
};

export const WalletViewContext = createContext<WalletViewContextType | null>(null);

export const useWalletView = (): WalletViewContextType => {
  const context: WalletViewContextType | null = useContext(WalletViewContext);

  if (context === null) {
    throw new Error("You must add a <WalletViewProvider> into the React tree");
  }

  return context;
};
