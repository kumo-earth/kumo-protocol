type NoneView = "NONE";
type OpenView = "OPEN";

export type WalletView = NoneView | OpenView;

type OpenModalPressedEvent = "OPEN_MODAL_PRESSED";
type CloseModalPressedEvent = "CLOSE_MODAL_PRESSED";

export type WalletEvent = OpenModalPressedEvent | CloseModalPressedEvent;
