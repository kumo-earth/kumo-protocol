import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useLiquitySelector } from "@liquity/lib-react";
import { LiquityStoreState, UserTroveStatus } from "@liquity/lib-base";
import { TroveViewContext } from "./TroveViewContext";
import type { TroveView, TroveEvent } from "./types";
import { useDashboard } from "../../../hooks/DashboardContext";

type TroveEventTransitions = Record<TroveView, Partial<Record<TroveEvent, TroveView>>>;

const transitions: TroveEventTransitions = {
  NONE: {
    OPEN_TROVE_PRESSED: "OPENING",
    TROVE_OPENED: "ACTIVE"
  },
  LIQUIDATED: {
    OPEN_TROVE_PRESSED: "OPENING",
    TROVE_SURPLUS_COLLATERAL_CLAIMED: "NONE",
    TROVE_OPENED: "ACTIVE"
  },
  REDEEMED: {
    OPEN_TROVE_PRESSED: "OPENING",
    TROVE_SURPLUS_COLLATERAL_CLAIMED: "NONE",
    TROVE_OPENED: "ACTIVE"
  },
  OPENING: {
    CANCEL_ADJUST_TROVE_PRESSED: "NONE",
    TROVE_OPENED: "ACTIVE"
  },
  ADJUSTING: {
    CANCEL_ADJUST_TROVE_PRESSED: "ACTIVE",
    TROVE_ADJUSTED: "ACTIVE",
    TROVE_CLOSED: "NONE",
    TROVE_LIQUIDATED: "LIQUIDATED",
    TROVE_REDEEMED: "REDEEMED"
  },
  CLOSING: {
    CANCEL_ADJUST_TROVE_PRESSED: "ACTIVE",
    TROVE_CLOSED: "NONE",
    TROVE_ADJUSTED: "ACTIVE",
    TROVE_LIQUIDATED: "LIQUIDATED",
    TROVE_REDEEMED: "REDEEMED"
  },
  ACTIVE: {
    ADJUST_TROVE_PRESSED: "ADJUSTING",
    CLOSE_TROVE_PRESSED: "CLOSING",
    TROVE_CLOSED: "NONE",
    TROVE_LIQUIDATED: "LIQUIDATED",
    TROVE_REDEEMED: "REDEEMED"
  }
};

type TroveStateEvents = Partial<Record<UserTroveStatus, TroveEvent>>;

const troveStatusEvents: TroveStateEvents = {
  open: "TROVE_OPENED",
  closedByOwner: "TROVE_CLOSED",
  closedByLiquidation: "TROVE_LIQUIDATED",
  closedByRedemption: "TROVE_REDEEMED"
};

const transition = (view: TroveView, event: TroveEvent): TroveView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (troveStatus: UserTroveStatus): TroveView => {
  if (troveStatus === "closedByLiquidation") {
    return "LIQUIDATED";
  }
  if (troveStatus === "closedByRedemption") {
    return "REDEEMED";
  }
  if (troveStatus === "open") {
    return "ACTIVE";
  }
  return "NONE";
};

const select = ({ trove: { status } }: LiquityStoreState) => status;
const getPathName = (location: any) => {
  return location && location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
};

export const TroveViewProvider: React.FC = props => {
  const { children } = props;
  // const troveStatus = useLiquitySelector(select);
  const location = useLocation();
  const { vaults, openTroveT } = useDashboard();

  const vaultType = vaults.find(vault => vault.type === getPathName(location)) ?? vaults[0];
  const { troveStatus } = vaultType;

  const [view, setView] = useState<TroveView>(getInitialView(troveStatus));
  const viewRef = useRef<TroveView>(view);
  const dispatchEvent = useCallback((event: TroveEvent) => {
    const nextView = transition(viewRef.current, event);

    console.log(
      "dispatchEvent() [current-view, event, next-view]",
      viewRef.current,
      event,
      nextView
    );
    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (view !== "OPENING") {
      setView(getInitialView(troveStatus));
    }
  }, [troveStatus]);

  useEffect(() => {
    const event = troveStatusEvents[troveStatus] ?? null;
    if (event !== null) {
      dispatchEvent(event);
    }
  }, [troveStatus, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };
  return <TroveViewContext.Provider value={provider}>{children}</TroveViewContext.Provider>;
};
