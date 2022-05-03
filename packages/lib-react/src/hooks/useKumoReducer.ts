import { useCallback, useEffect, useReducer, useRef } from "react";

import { KumoStoreState } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useKumoStore } from "./useKumoStore";

export type KumoStoreUpdate<T = unknown> = {
  type: "updateStore";
  newState: KumoStoreState<T>;
  oldState: KumoStoreState<T>;
  stateChange: Partial<KumoStoreState<T>>;
};

export const useKumoReducer = <S, A, T>(
  reduce: (state: S, action: A | KumoStoreUpdate<T>) => S,
  init: (storeState: KumoStoreState<T>) => S
): [S, (action: A | KumoStoreUpdate<T>) => void] => {
  const store = useKumoStore<T>();
  const oldStore = useRef(store);
  const state = useRef(init(store.state));
  const [, rerender] = useReducer(() => ({}), {});

  const dispatch = useCallback(
    (action: A | KumoStoreUpdate<T>) => {
      const newState = reduce(state.current, action);

      if (!equals(newState, state.current)) {
        state.current = newState;
        rerender();
      }
    },
    [reduce]
  );

  useEffect(() => store.subscribe(params => dispatch({ type: "updateStore", ...params })), [
    store,
    dispatch
  ]);

  if (oldStore.current !== store) {
    state.current = init(store.state);
    oldStore.current = store;
  }

  return [state.current, dispatch];
};
