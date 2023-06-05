type NoneView = "NONE";
type OpenView = "OPEN";

export type AddAssetView = NoneView | OpenView;

type OpenModalPressedEvent = "OPEN_ADD_ASSET_MODAL_PRESSED";
type CloseModalPressedEvent = "CLOSE_ADD_ASSET_MODAL_PRESSED";

export type AddAssetEvent = OpenModalPressedEvent | CloseModalPressedEvent;
