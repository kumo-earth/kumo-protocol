import React, { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { SwitchNetworkViewContext } from "./SwitchNetworkViewContext";
import type { SwitchNetworkView, SwitchNetworkEvent } from "./types";

type SwitchNetworkEventTransitions = Record<SwitchNetworkView, Partial<Record<SwitchNetworkEvent, SwitchNetworkView>>>;

const transitions: SwitchNetworkEventTransitions = {
  NONE: {
    CLOSE_SWITCH_MODAL_PRESSED: "NONE",
  },
  OPEN: {
    OPEN_SWITCH_MODAL_PRESSED: "OPEN",
  }
};

const transition = (view: SwitchNetworkView, event: SwitchNetworkEvent): SwitchNetworkView => {
    const nextView = transitions[view][event] ?? view;
    return nextView;
  };


export const SwitchNetworkViewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {  
  const [view, setView] = useState<SwitchNetworkView>("NONE");
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const viewRef = useRef<SwitchNetworkView>(view);
  const dispatchEvent = useCallback((event: SwitchNetworkEvent) => {
    if(event === 'OPEN_SWITCH_MODAL_PRESSED'){
        viewRef.current = "OPEN";
        setShowSwitchModal(true)
    } else if(event === "CLOSE_SWITCH_MODAL_PRESSED"){
        viewRef.current = "NONE";
        setShowSwitchModal(false)
    }
    const nextView = transition(viewRef.current, event);
    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);


  const provider = {
    view,
    showSwitchModal,
    dispatchEvent
  };
  return <SwitchNetworkViewContext.Provider value={provider}>{children}</SwitchNetworkViewContext.Provider>;
};
