import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { StabilityViewContext } from "./StabilityViewContext";
import { useDashboard } from "../../../hooks/DashboardContext";
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

const transition = (view: StabilityView, event: StabilityEvent): StabilityView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (isEmpty: Boolean): StabilityView => {
  return isEmpty ? "NONE" : "ACTIVE";
};

const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const StabilityViewProvider: React.FC = props => {
  const { children } = props;
  // const stabilityDeposit = useLiquitySelector(select);
  const location = useLocation();
  const { vaults } = useDashboard();
  const vaultType = vaults.find(vault => vault.type === getPathName(location)) ?? vaults[0];
  const isEmpty = vaultType.stabilityStatus;

  const [view, setView] = useState<StabilityView>(getInitialView(isEmpty));
  const viewRef = useRef<StabilityView>(view);

  const dispatchEvent = useCallback((event: StabilityEvent) => {
    if (event === "DEPOSIT_PRESSED" && isEmpty) {
      const nextView = transition("DEPOSITING", event);
      setView(nextView);
    } else {
      const nextView = isEmpty ? transition(viewRef.current, event) : transition("ACTIVE", event);
      setView(nextView);
    }
  }, [isEmpty]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (isEmpty) {
      dispatchEvent("DEPOSIT_EMPTIED");
    } else {
      if (!isEmpty && viewRef.current !== "ACTIVE" && viewRef.current !== "ADJUSTING") {
        setView("ACTIVE");
      }
    }
  }, [isEmpty, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <StabilityViewContext.Provider value={provider}>{children}</StabilityViewContext.Provider>;
};
