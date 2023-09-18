import React, { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { AddAssetViewContext } from "./AssetViewContext";
import type { AddAssetView, AddAssetEvent } from "./types";

type AddAssetEventTransitions = Record<AddAssetView, Partial<Record<AddAssetEvent, AddAssetView>>>;

const transitions: AddAssetEventTransitions = {
  NONE: {
    CLOSE_ADD_ASSET_MODAL_PRESSED: "NONE"
  },
  OPEN: {
    OPEN_ADD_ASSET_MODAL_PRESSED: "OPEN"
  }
};

const transition = (view: AddAssetView, event: AddAssetEvent): AddAssetView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

export const AddAssetViewProvider: React.FC<{ children: ReactNode }> = props => {
  const { children } = props;

  const [view, setView] = useState<AddAssetView>("NONE");
  const [showAddAssetModal, setShowModal] = useState(false)
  const viewRef = useRef<AddAssetView>(view);
  const dispatchEvent = useCallback((event: AddAssetEvent) => {
   
    if (event === "OPEN_ADD_ASSET_MODAL_PRESSED") {
      setShowModal(true)
      viewRef.current = "OPEN";
    } else if (event === "CLOSE_ADD_ASSET_MODAL_PRESSED") {
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
    showAddAssetModal,
    dispatchEvent
  };
  return <AddAssetViewContext.Provider value={provider}>{children}</AddAssetViewContext.Provider>;
};
