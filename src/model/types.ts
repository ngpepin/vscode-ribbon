export const SLOT_COUNT = 128;

export type SlotId = number;

export interface RibbonItem {
  id: string;
  slotId: SlotId;
  label: string;
  icon: string;
  commandId: string;
  args?: unknown[];
  tooltip?: string;
  shortcutLabel?: string;
  when?: string;
}

export interface RibbonGroup {
  id: string;
  title: string;
  order: number;
  items: RibbonItem[];
}

export interface RibbonTab {
  id: string;
  title: string;
  order: number;
  groups: RibbonGroup[];
}

export interface RibbonLayout {
  version: 1;
  tabs: RibbonTab[];
}

export interface RibbonSettings {
  enabled: boolean;
  showLabels: boolean;
  iconSize: "small" | "medium" | "large";
  compactMode: boolean;
  slotMinWidth: number;
  slotMaxWidth: number;
  slotShowOutline: boolean;
  writeTarget: "user" | "workspace";
  autoAcceptCommandPaletteSelection: boolean;
  capturePaletteWrapperCommands: boolean;
}

export interface RenderRibbonItem extends RibbonItem {
  isCommandAvailable: boolean;
}

export interface RenderRibbonGroup extends Omit<RibbonGroup, "items"> {
  items: RenderRibbonItem[];
}

export interface RenderRibbonTab extends Omit<RibbonTab, "groups"> {
  groups: RenderRibbonGroup[];
}

export interface RenderRibbonLayout extends Omit<RibbonLayout, "tabs"> {
  tabs: RenderRibbonTab[];
}
