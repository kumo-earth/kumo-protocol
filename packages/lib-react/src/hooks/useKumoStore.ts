import { useContext } from "react";

import { KumoStore } from "@liquity/lib-base";

import { KumoStoreContext } from "../components/KumoStoreProvider";

export const useKumoStore = <T>(): KumoStore<T> => {
  const store = useContext(KumoStoreContext);

  if (!store) {
    throw new Error("You must provide a KumoStore via KumoStoreProvider");
  }

  return store as KumoStore<T>;
};