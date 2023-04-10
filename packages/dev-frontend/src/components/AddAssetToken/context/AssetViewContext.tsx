import { createContext, useContext } from "react";
import type { AddAssetView, AddAssetEvent } from "./types";

type AddAssetViewContextType = {
  view: AddAssetView;
  showAddAssetModal: boolean;
  dispatchEvent: (event: AddAssetEvent) => void;
};

export const AddAssetViewContext = createContext<AddAssetViewContextType | null>(null);

export const useAddAssetModal = (): AddAssetViewContextType => {
  const context: AddAssetViewContextType | null = useContext(AddAssetViewContext);

  if (context === null) {
    throw new Error("You must add a <AddAssetViewProvider> into the React tree");
  }

  return context;
};
