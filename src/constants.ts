import { SLOT_COUNT } from "./model/types";

export const EXTENSION_NAMESPACE = "vscodeRibbon";
export const VIEW_ID = "vscodeRibbon.view";
export const VIEW_CONTAINER_ID = "vscodeRibbon";
export const CONTROL_VIEW_ID = "vscodeRibbon.controlView";
export const CONTROL_VIEW_CONTAINER_ID = "vscodeRibbonControl";
export const SLOT_COMMAND_PREFIX = "vscodeRibbon.slot";

export const CORE_COMMANDS = {
  focus: "vscodeRibbon.focus",
  toggleEnabled: "vscodeRibbon.toggleEnabled",
  toggleCustomizeMode: "vscodeRibbon.toggleCustomizeMode",
  assignSlotFromPalette: "vscodeRibbon.assignSlotFromPalette",
  assignSlotManual: "vscodeRibbon.assignSlotManual",
  clearSlot: "vscodeRibbon.clearSlot",
  exportLayout: "vscodeRibbon.exportLayout",
  importLayout: "vscodeRibbon.importLayout",
  setWriteTargetUser: "vscodeRibbon.setWriteTargetUser",
  setWriteTargetWorkspace: "vscodeRibbon.setWriteTargetWorkspace",
  copyKeybindingSnippet: "vscodeRibbon.copyKeybindingSnippet"
} as const;

export function slotCommandId(slotId: number): string {
  const normalized = String(Math.max(1, Math.min(SLOT_COUNT, Math.round(slotId)))).padStart(3, "0");
  return `${SLOT_COMMAND_PREFIX}${normalized}`;
}
