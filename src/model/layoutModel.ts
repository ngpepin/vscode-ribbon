import { RibbonGroup, RibbonItem, RibbonLayout, RibbonTab, SLOT_COUNT, SlotId } from "./types";

const FONT_AWESOME_SOLID_ICON_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/solid";

type ValidationResult =
  | { ok: true; layout: RibbonLayout }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

function normalizeItem(item: RibbonItem): RibbonItem {
  return {
    ...item,
    slotId: clampSlot(item.slotId),
    args: Array.isArray(item.args) ? item.args : undefined,
    tooltip: item.tooltip || undefined,
    shortcutLabel: item.shortcutLabel || undefined,
    when: item.when || undefined
  };
}

function normalizeGroup(group: RibbonGroup): RibbonGroup {
  return {
    ...group,
    title: group.title.trim() || "Group",
    items: group.items.map(normalizeItem)
  };
}

function normalizeTab(tab: RibbonTab): RibbonTab {
  return {
    ...tab,
    title: tab.title.trim() || "Tab",
    groups: normalizeOrder(tab.groups.map(normalizeGroup))
  };
}

export function clampSlot(slotId: number): SlotId {
  if (slotId < 1) {
    return 1;
  }
  if (slotId > SLOT_COUNT) {
    return SLOT_COUNT;
  }
  return Math.round(slotId);
}

export function createDefaultLayout(): RibbonLayout {
  return {
    version: 1,
    tabs: [
      {
        id: "home",
        title: "Home",
        order: 0,
        groups: [
          {
            id: "common",
            title: "Common",
            order: 0,
            items: [
              {
                id: "slot-001",
                slotId: 1,
                label: "Palette",
                icon: "terminal-cmd",
                commandId: "workbench.action.showCommands",
                tooltip: "Open Command Palette",
                shortcutLabel: "Ctrl+Shift+P"
              },
              {
                id: "slot-002",
                slotId: 2,
                label: "Quick Open",
                icon: "search",
                commandId: "workbench.action.quickOpen",
                tooltip: "Open file by name",
                shortcutLabel: "Ctrl+P"
              },
              {
                id: "slot-003",
                slotId: 3,
                label: "Save",
                icon: "save",
                commandId: "workbench.action.files.save",
                tooltip: "Save active editor",
                shortcutLabel: "Ctrl+S"
              }
            ]
          }
        ]
      },
      {
        id: "edit",
        title: "Edit",
        order: 1,
        groups: [
          {
            id: "editing",
            title: "Editing",
            order: 0,
            items: [
              {
                id: "slot-004",
                slotId: 4,
                label: "Undo",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/rotate-left.svg`,
                commandId: "undo",
                tooltip: "Undo last edit",
                shortcutLabel: "Ctrl+Z"
              },
              {
                id: "slot-005",
                slotId: 5,
                label: "Redo",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/rotate-right.svg`,
                commandId: "redo",
                tooltip: "Redo last edit",
                shortcutLabel: "Ctrl+Y"
              },
              {
                id: "slot-006",
                slotId: 6,
                label: "Cut",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/scissors.svg`,
                commandId: "editor.action.clipboardCutAction",
                tooltip: "Cut selection",
                shortcutLabel: "Ctrl+X"
              },
              {
                id: "slot-007",
                slotId: 7,
                label: "Copy",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/copy.svg`,
                commandId: "editor.action.clipboardCopyAction",
                tooltip: "Copy selection",
                shortcutLabel: "Ctrl+C"
              },
              {
                id: "slot-008",
                slotId: 8,
                label: "Paste",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/paste.svg`,
                commandId: "editor.action.clipboardPasteAction",
                tooltip: "Paste from clipboard",
                shortcutLabel: "Ctrl+V"
              },
              {
                id: "slot-009",
                slotId: 9,
                label: "Find",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/magnifying-glass.svg`,
                commandId: "actions.find",
                tooltip: "Find in current editor",
                shortcutLabel: "Ctrl+F"
              },
              {
                id: "slot-010",
                slotId: 10,
                label: "Replace",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/arrows-rotate.svg`,
                commandId: "editor.action.startFindReplaceAction",
                tooltip: "Find and replace",
                shortcutLabel: "Ctrl+H"
              },
              {
                id: "slot-011",
                slotId: 11,
                label: "Toggle Comment",
                icon: `${FONT_AWESOME_SOLID_ICON_BASE_URL}/comment.svg`,
                commandId: "editor.action.commentLine",
                tooltip: "Toggle line comment",
                shortcutLabel: "Ctrl+/"
              }
            ]
          }
        ]
      }
    ]
  };
}

function validateItem(value: unknown): value is RibbonItem {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return false;
  }
  if (typeof value.label !== "string" || value.label.length === 0) {
    return false;
  }
  if (typeof value.icon !== "string") {
    return false;
  }
  if (typeof value.commandId !== "string") {
    return false;
  }
  if (typeof value.slotId !== "number" || value.slotId < 1 || value.slotId > SLOT_COUNT) {
    return false;
  }
  if (value.args !== undefined && !Array.isArray(value.args)) {
    return false;
  }
  return true;
}

function validateGroup(value: unknown): value is RibbonGroup {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return false;
  }
  if (typeof value.title !== "string") {
    return false;
  }
  if (typeof value.order !== "number") {
    return false;
  }
  if (!Array.isArray(value.items) || !value.items.every(validateItem)) {
    return false;
  }
  return true;
}

function validateTab(value: unknown): value is RibbonTab {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return false;
  }
  if (typeof value.title !== "string") {
    return false;
  }
  if (typeof value.order !== "number") {
    return false;
  }
  if (!Array.isArray(value.groups) || !value.groups.every(validateGroup)) {
    return false;
  }
  return true;
}

export function validateLayout(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Layout must be an object." };
  }
  if (value.version !== 1) {
    return { ok: false, error: "Only layout version 1 is supported." };
  }
  if (!Array.isArray(value.tabs) || !value.tabs.every(validateTab)) {
    return { ok: false, error: "Layout tabs are invalid." };
  }
  const normalized: RibbonLayout = {
    version: 1,
    tabs: normalizeOrder(value.tabs.map(normalizeTab))
  };
  return { ok: true, layout: normalized };
}

export function parseLayoutOrDefault(value: unknown): { layout: RibbonLayout; usedDefault: boolean; error?: string } {
  const result = validateLayout(value);
  if (result.ok) {
    if (result.layout.tabs.length > 0) {
      return { layout: result.layout, usedDefault: false };
    }
    return { layout: createDefaultLayout(), usedDefault: true, error: "Layout was empty." };
  }
  return { layout: createDefaultLayout(), usedDefault: true, error: result.error };
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${random}`;
}

function getFirstGroup(layout: RibbonLayout): RibbonGroup | undefined {
  const tab = normalizeOrder(layout.tabs)[0];
  if (!tab) {
    return undefined;
  }
  return normalizeOrder(tab.groups)[0];
}

export function ensureLayoutHasRoot(layout: RibbonLayout): RibbonLayout {
  if (layout.tabs.length > 0 && layout.tabs[0]?.groups.length > 0) {
    return layout;
  }
  return createDefaultLayout();
}

export function getItemBySlot(layout: RibbonLayout, slotId: number): RibbonItem | undefined {
  for (const tab of layout.tabs) {
    for (const group of tab.groups) {
      const found = group.items.find((item) => item.slotId === slotId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

export function getItemById(layout: RibbonLayout, itemId: string): RibbonItem | undefined {
  for (const tab of layout.tabs) {
    for (const group of tab.groups) {
      const found = group.items.find((item) => item.id === itemId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

export function updateLayoutItem(
  layout: RibbonLayout,
  itemId: string,
  updater: (item: RibbonItem) => RibbonItem
): RibbonLayout {
  return {
    ...layout,
    tabs: layout.tabs.map((tab) => ({
      ...tab,
      groups: tab.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => (item.id === itemId ? updater(item) : item))
      }))
    }))
  };
}

export function assignCommandToSlot(
  layout: RibbonLayout,
  slotId: number,
  commandId: string,
  options?: { label?: string; shortcutLabel?: string; args?: unknown[] }
): RibbonLayout {
  const normalizedLayout = ensureLayoutHasRoot(layout);
  const normalizedSlot = clampSlot(slotId);
  const existing = getItemBySlot(normalizedLayout, normalizedSlot);
  if (existing) {
    return updateLayoutItem(normalizedLayout, existing.id, (item) => ({
      ...item,
      commandId,
      label: options?.label || item.label || `Slot ${String(normalizedSlot).padStart(3, "0")}`,
      shortcutLabel: options?.shortcutLabel ?? item.shortcutLabel,
      args: options?.args
    }));
  }

  const firstGroup = getFirstGroup(normalizedLayout);
  if (!firstGroup) {
    return createDefaultLayout();
  }

  const newItem: RibbonItem = normalizeItem({
    id: createId(`slot-${String(normalizedSlot).padStart(3, "0")}`),
    slotId: normalizedSlot,
    label: options?.label || `Slot ${String(normalizedSlot).padStart(3, "0")}`,
    icon: "symbol-method",
    commandId,
    args: options?.args,
    shortcutLabel: options?.shortcutLabel
  });

  return {
    ...normalizedLayout,
    tabs: normalizedLayout.tabs.map((tab) => ({
      ...tab,
      groups: tab.groups.map((group) => {
        if (group.id !== firstGroup.id) {
          return group;
        }
        return { ...group, items: [...group.items, newItem] };
      })
    }))
  };
}

export function clearSlot(layout: RibbonLayout, slotId: number): RibbonLayout {
  const existing = getItemBySlot(layout, slotId);
  if (!existing) {
    return layout;
  }
  return updateLayoutItem(layout, existing.id, (item) => ({
    ...item,
    commandId: "",
    tooltip: "Unassigned slot"
  }));
}

export function normalizeLooseLayout(value: unknown): RibbonLayout {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.tabs)) {
    return createDefaultLayout();
  }

  const tabs: RibbonTab[] = value.tabs
    .filter((tab): tab is Record<string, unknown> => isRecord(tab))
    .map((tab, tabIndex) => {
      const groupsSource = Array.isArray(tab.groups) ? tab.groups : [];
      const groups: RibbonGroup[] = groupsSource
        .filter((group): group is Record<string, unknown> => isRecord(group))
        .map((group, groupIndex) => {
          const itemsSource = Array.isArray(group.items) ? group.items : [];
          const items: RibbonItem[] = itemsSource
            .filter((item): item is Record<string, unknown> => isRecord(item))
            .map((item, itemIndex) =>
              normalizeItem({
                id: asString(item.id, createId(`item-${tabIndex}-${groupIndex}-${itemIndex}`)),
                slotId: clampSlot(asNumber(item.slotId, itemIndex + 1)),
                label: asString(item.label, `Slot ${itemIndex + 1}`),
                icon: asString(item.icon, "symbol-method"),
                commandId: asString(item.commandId),
                args: Array.isArray(item.args) ? item.args : undefined,
                tooltip: asString(item.tooltip) || undefined,
                shortcutLabel: asString(item.shortcutLabel) || undefined,
                when: asString(item.when) || undefined
              })
            );
          return {
            id: asString(group.id, createId(`group-${tabIndex}-${groupIndex}`)),
            title: asString(group.title, "Group"),
            order: asNumber(group.order, groupIndex),
            items
          };
        });
      return {
        id: asString(tab.id, createId(`tab-${tabIndex}`)),
        title: asString(tab.title, "Tab"),
        order: asNumber(tab.order, tabIndex),
        groups
      };
    });

  const normalized = {
    version: 1 as const,
    tabs: normalizeOrder(tabs.map(normalizeTab))
  };
  return normalized.tabs.length > 0 ? normalized : createDefaultLayout();
}
