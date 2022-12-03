type NoneView = "NONE";
type OpenView = "OPEN";

export type SwitchNetworkView =
  | NoneView
  | OpenView

type OpenModalPressedEvent = "OPEN_SWITCH_MODAL_PRESSED";
type CloseModalPressedEvent = "CLOSE_SWITCH_MODAL_PRESSED";


export type SwitchNetworkEvent =
  | OpenModalPressedEvent
  | CloseModalPressedEvent