import React, { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { WalletViewContext } from "./WalletViewContext";
import type { WalletView, WalletEvent } from "./types";

type WalletEventTransitions = Record<WalletView, Partial<Record<WalletEvent, WalletView>>>;

const transitions: WalletEventTransitions = {
  NONE: {
    CLOSE_WALLET_MODAL_PRESSED: "NONE"
  },
  OPEN: {
    OPEN_WALLET_MODAL_PRESSED: "OPEN"
  }
};

const transition = (view: WalletView, event: WalletEvent): WalletView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

export const WalletViewProvider: React.FC<{ children: ReactNode }> = props => {
  const { children } = props;

  const [view, setView] = useState<WalletView>("NONE");
  const [showModal, setShowModal] = useState(false)
  const viewRef = useRef<WalletView>(view);
  const dispatchEvent = useCallback((event: WalletEvent) => {
   
    if (event === "OPEN_WALLET_MODAL_PRESSED") {
      setShowModal(true)
      viewRef.current = "OPEN";
    } else if (event === "CLOSE_WALLET_MODAL_PRESSED") {
      viewRef.current = "NONE";
      setShowModal(false)
    }
    const nextView = transition(viewRef.current, event);
    
    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);


  const provider = {
    view,
    showModal,
    dispatchEvent
  };
  return <WalletViewContext.Provider value={provider}>{children}</WalletViewContext.Provider>;
};
