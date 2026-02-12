import * as assert from "assert";
import {
  assignCommandToSlot,
  clearSlot,
  createDefaultLayout,
  parseLayoutOrDefault,
  validateLayout
} from "../../model/layoutModel";

describe("layoutModel", () => {
  it("invalid layout falls back to default", () => {
    const result = parseLayoutOrDefault({ version: 2, tabs: [] });
    assert.strictEqual(result.usedDefault, true);
    assert.strictEqual(result.layout.version, 1);
    assert.ok(result.layout.tabs.length > 0);
  });

  it("default layout validates", () => {
    const layout = createDefaultLayout();
    const validation = validateLayout(layout);
    assert.strictEqual(validation.ok, true);
  });

  it("default layout includes edit tab with public icon urls", () => {
    const layout = createDefaultLayout();
    const editTab = layout.tabs.find((tab) => tab.id === "edit");
    assert.ok(editTab);
    const editItems = editTab?.groups.flatMap((group) => group.items) ?? [];
    assert.ok(editItems.length >= 7);
    for (const item of editItems) {
      assert.ok(item.icon.startsWith("https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/solid/"));
    }
  });

  it("assignCommandToSlot updates existing slot", () => {
    const layout = createDefaultLayout();
    const next = assignCommandToSlot(layout, 1, "workbench.action.openSettings", {
      label: "Settings"
    });
    const firstItem = next.tabs[0].groups[0].items.find((item) => item.slotId === 1);
    assert.ok(firstItem);
    assert.strictEqual(firstItem?.commandId, "workbench.action.openSettings");
    assert.strictEqual(firstItem?.label, "Settings");
  });

  it("assignCommandToSlot creates item if slot missing", () => {
    const layout = createDefaultLayout();
    const next = assignCommandToSlot(layout, 42, "workbench.action.quickOpen");
    const created = next.tabs.flatMap((tab) => tab.groups.flatMap((group) => group.items)).find((item) => item.slotId === 42);
    assert.ok(created);
    assert.strictEqual(created?.commandId, "workbench.action.quickOpen");
  });

  it("assignCommandToSlot stores captured args", () => {
    const layout = createDefaultLayout();
    const next = assignCommandToSlot(layout, 4, "workbench.action.quickOpen", {
      args: [">View: Toggle Terminal"]
    });
    const item = next.tabs.flatMap((tab) => tab.groups.flatMap((group) => group.items)).find((entry) => entry.slotId === 4);
    assert.ok(item);
    assert.deepStrictEqual(item?.args, [">View: Toggle Terminal"]);
  });

  it("clearSlot removes command assignment", () => {
    const layout = createDefaultLayout();
    const cleared = clearSlot(layout, 1);
    const item = cleared.tabs[0].groups[0].items.find((entry) => entry.slotId === 1);
    assert.ok(item);
    assert.strictEqual(item?.commandId, "");
  });
});
