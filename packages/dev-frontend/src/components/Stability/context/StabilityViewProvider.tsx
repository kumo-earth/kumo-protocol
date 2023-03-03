import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useKumoSelector } from "@kumodao/lib-react";
import { KumoStoreState, StabilityDeposit } from "@kumodao/lib-base";
import { StabilityViewContext } from "./StabilityViewContext";
import type { StabilityView, StabilityEvent } from "./types";

type StabilityEventTransitions = Record<
  StabilityView,
  Partial<Record<StabilityEvent, StabilityView>>
>;

const transitions: StabilityEventTransitions = {
  NONE: {
    DEPOSIT_PRESSED: "DEPOSITING"
  },
  DEPOSITING: {
    CANCEL_PRESSED: "NONE",
    DEPOSIT_CONFIRMED: "ACTIVE"
  },
  ACTIVE: {
    REWARDS_CLAIMED: "ACTIVE",
    ADJUST_DEPOSIT_PRESSED: "ADJUSTING",
    DEPOSIT_EMPTIED: "NONE"
  },
  ADJUSTING: {
    CANCEL_PRESSED: "ACTIVE",
    DEPOSIT_CONFIRMED: "ACTIVE",
    DEPOSIT_EMPTIED: "NONE"
  }
};

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

const transition = (view: StabilityView, event: StabilityEvent): StabilityView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (stabilityDeposit?: StabilityDeposit): StabilityView => {
  return stabilityDeposit?.isEmpty ? "NONE" : "ACTIVE";
};

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const StabilityViewProvider: React.FC = props => {
  const { children } = props;
  const { vaults } = useKumoSelector(select);
  const location = useLocation();

  const vault = vaults.find(vault => vault.asset === getPathName(location));
  const stabilityDeposit = vault?.stabilityDeposit && vault.stabilityDeposit;

  const [view, setView] = useState<StabilityView>(getInitialView(stabilityDeposit));
  const [showModal, setShowModal] = useState(false);
  const viewRef = useRef<StabilityView>(view);

  const dispatchEvent = useCallback((event: StabilityEvent) => {
    if (event === "CLOSE_MODAL_PRESSED") {
      setShowModal(false);
      return;
    } else if (event === "OPEN_MODAL_PRESSED") {
      setShowModal(true);
      return;
    }

    const nextView = transition(viewRef.current, event);
    console.log("nextView", nextView, viewRef.current, event);

    console.log(
      "dispatchEvent() [current-view, event, next-view]",
      viewRef.current,
      event,
      nextView
    );
    setView(nextView);
  }, []);

  useEffect(() => {
    setView(getInitialView(stabilityDeposit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPathName(location)]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (stabilityDeposit?.isEmpty) {
      dispatchEvent("DEPOSIT_EMPTIED");
    }
  }, [stabilityDeposit?.isEmpty, dispatchEvent]);

  const provider = {
    view,
    showModal,
    dispatchEvent
  };

  return <StabilityViewContext.Provider value={provider}>{children}</StabilityViewContext.Provider>;
};
