import { useEffect, useReducer } from "react";

import { KumoStoreState } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useKumoStore } from "./useKumoStore";

export const useKumoSelector = <S, T>(select: (state: KumoStoreState<T>) => S): S => {
  const store = useKumoStore<T>();
  const [, rerender] = useReducer(() => ({}), {});

  useEffect(
    () =>
      store.subscribe(({ newState, oldState }) => {
        if (!equals(select(newState), select(oldState))) {
          rerender();
        }
      }),
    [store, select]
  );

  return select(store.state);
};
