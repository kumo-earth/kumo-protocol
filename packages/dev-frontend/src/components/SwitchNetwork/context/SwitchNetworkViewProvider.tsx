import React, { useState, useCallback, useEffect, useRef } from "react";
import { SwitchNetworkViewContext } from "./SwitchNetworkViewContext";
import type { SwitchNetworkView, SwitchNetworkEvent } from "./types";

type SwitchNetworkEventTransitions = Record<SwitchNetworkView, Partial<Record<SwitchNetworkEvent, SwitchNetworkView>>>;

const transitions: SwitchNetworkEventTransitions = {
  NONE: {
    CLOSE_MODAL_PRESSED: "NONE",
  },
  OPEN: {
    OPEN_MODAL_PRESSED: "OPEN",
  }
};

const transition = (view: SwitchNetworkView, event: SwitchNetworkEvent): SwitchNetworkView => {
    const nextView = transitions[view][event] ?? view;
    return nextView;
  };


export const SwitchNetworkViewProvider: React.FC = props => {
  const { children } = props;
  
  const [view, setView] = useState<SwitchNetworkView>("NONE");
  const viewRef = useRef<SwitchNetworkView>(view);
  const dispatchEvent = useCallback((event: SwitchNetworkEvent) => {
    if(event === 'OPEN_MODAL_PRESSED'){
        viewRef.current = "OPEN";
    } else if(event === "CLOSE_MODAL_PRESSED"){
        viewRef.current = "NONE";
    }
    const nextView = transition(viewRef.current, event);
    console.log("dispatchEvent", nextView)
    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);


  const provider = {
    view,
    dispatchEvent
  };
  return <SwitchNetworkViewContext.Provider value={provider}>{children}</SwitchNetworkViewContext.Provider>;
};
