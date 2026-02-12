(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  const toolbar = document.getElementById("ribbon-toolbar");
  const content = document.getElementById("ribbon-content");

  const state = {
    layout: null,
    settings: {
      enabled: true,
      showLabels: true,
      iconSize: "medium",
      compactMode: false,
      slotMinWidth: 112,
      slotMaxWidth: 280,
      slotShowOutline: false
    },
    customizeMode: false,
    slotCount: 128,
    missingCommandIds: new Set(),
    activeTabId: null,
    panelPosition: "bottom"
  };

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function send(message) {
    vscode.postMessage(message);
  }

  function clampedSlotMaxWidth(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 280;
    }
    return Math.max(140, Math.min(640, Math.round(parsed)));
  }

  function clampedSlotMinWidth(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 112;
    }
    return Math.max(72, Math.min(400, Math.round(parsed)));
  }

  function normalizePanelPosition(value) {
    return value === "top" || value === "bottom" || value === "left" || value === "right" ? value : "bottom";
  }

  function normalizeOrders(layout) {
    if (!layout || !Array.isArray(layout.tabs)) {
      return layout;
    }
    layout.tabs = layout.tabs
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((tab, tabIndex) => {
        tab.order = tabIndex;
        tab.groups = (tab.groups || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((group, groupIndex) => {
            group.order = groupIndex;
            group.items = (group.items || []).slice();
            return group;
          });
        return tab;
      });
    return layout;
  }

  function ensureActiveTab() {
    if (!state.layout || !Array.isArray(state.layout.tabs) || state.layout.tabs.length === 0) {
      state.activeTabId = null;
      return;
    }
    const tabs = state.layout.tabs.slice().sort((a, b) => a.order - b.order);
    if (!state.activeTabId || !tabs.some((tab) => tab.id === state.activeTabId)) {
      state.activeTabId = tabs[0].id;
    }
  }

  function findActiveTab() {
    if (!state.layout) {
      return null;
    }
    return state.layout.tabs.find((tab) => tab.id === state.activeTabId) || null;
  }

  function findGroupById(groupId) {
    const activeTab = findActiveTab();
    if (!activeTab) {
      return null;
    }
    return activeTab.groups.find((group) => group.id === groupId) || null;
  }

  function getAllItems() {
    if (!state.layout) {
      return [];
    }
    return state.layout.tabs.flatMap((tab) => tab.groups.flatMap((group) => group.items));
  }

  function isSlotTaken(slotId, ignoreItemId) {
    return getAllItems().some((item) => item.slotId === slotId && item.id !== ignoreItemId);
  }

  function setLayout(nextLayout, persist) {
    state.layout = normalizeOrders(nextLayout);
    ensureActiveTab();
    render();
    if (persist) {
      send({ type: "saveLayout", layout: state.layout });
    }
  }

  function promptText(prompt, value) {
    const result = window.prompt(prompt, value || "");
    if (result === null) {
      return null;
    }
    const trimmed = result.trim();
    return trimmed.length ? trimmed : null;
  }

  function promptSlot(defaultValue, ignoreItemId) {
    const raw = window.prompt(`Slot number (1-${state.slotCount})`, String(defaultValue || ""));
    if (raw === null) {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > state.slotCount) {
      window.alert(`Enter an integer between 1 and ${state.slotCount}.`);
      return null;
    }
    if (isSlotTaken(parsed, ignoreItemId)) {
      window.alert(`Slot ${parsed} is already used. Choose another slot.`);
      return null;
    }
    return parsed;
  }

  function newId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function addTab() {
    const title = promptText("Tab title", "New Tab");
    if (!title) {
      return;
    }
    const next = clone(state.layout);
    const tab = {
      id: newId("tab"),
      title,
      order: next.tabs.length,
      groups: [
        {
          id: newId("group"),
          title: "Group",
          order: 0,
          items: []
        }
      ]
    };
    next.tabs.push(tab);
    state.activeTabId = tab.id;
    setLayout(next, true);
  }

  function renameActiveTab() {
    const activeTab = findActiveTab();
    if (!activeTab) {
      return;
    }
    const title = promptText("Tab title", activeTab.title);
    if (!title) {
      return;
    }
    const next = clone(state.layout);
    const tab = next.tabs.find((item) => item.id === activeTab.id);
    tab.title = title;
    setLayout(next, true);
  }

  function moveActiveTab(direction) {
    const activeTab = findActiveTab();
    if (!activeTab) {
      return;
    }
    const next = clone(state.layout);
    const tabs = next.tabs.sort((a, b) => a.order - b.order);
    const index = tabs.findIndex((tab) => tab.id === activeTab.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= tabs.length) {
      return;
    }
    const temp = tabs[index];
    tabs[index] = tabs[target];
    tabs[target] = temp;
    next.tabs = tabs;
    setLayout(next, true);
  }

  function deleteActiveTab() {
    const activeTab = findActiveTab();
    if (!activeTab) {
      return;
    }
    if (!window.confirm(`Delete tab '${activeTab.title}'?`)) {
      return;
    }
    const next = clone(state.layout);
    next.tabs = next.tabs.filter((tab) => tab.id !== activeTab.id);
    if (next.tabs.length === 0) {
      next.tabs.push({
        id: newId("tab"),
        title: "Home",
        order: 0,
        groups: [
          {
            id: newId("group"),
            title: "Common",
            order: 0,
            items: []
          }
        ]
      });
    }
    setLayout(next, true);
  }

  function addGroup() {
    const activeTab = findActiveTab();
    if (!activeTab) {
      return;
    }
    const title = promptText("Group title", "Group");
    if (!title) {
      return;
    }
    const next = clone(state.layout);
    const tab = next.tabs.find((item) => item.id === activeTab.id);
    tab.groups.push({
      id: newId("group"),
      title,
      order: tab.groups.length,
      items: []
    });
    setLayout(next, true);
  }

  function renameGroup(groupId) {
    const group = findGroupById(groupId);
    if (!group) {
      return;
    }
    const title = promptText("Group title", group.title);
    if (!title) {
      return;
    }
    const next = clone(state.layout);
    const activeTab = next.tabs.find((tab) => tab.id === state.activeTabId);
    const targetGroup = activeTab.groups.find((item) => item.id === groupId);
    targetGroup.title = title;
    setLayout(next, true);
  }

  function moveGroup(groupId, direction) {
    const next = clone(state.layout);
    const activeTab = next.tabs.find((tab) => tab.id === state.activeTabId);
    const groups = activeTab.groups.sort((a, b) => a.order - b.order);
    const index = groups.findIndex((item) => item.id === groupId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= groups.length) {
      return;
    }
    const temp = groups[index];
    groups[index] = groups[target];
    groups[target] = temp;
    activeTab.groups = groups;
    setLayout(next, true);
  }

  function deleteGroup(groupId) {
    const group = findGroupById(groupId);
    if (!group) {
      return;
    }
    if (!window.confirm(`Delete group '${group.title}'?`)) {
      return;
    }
    const next = clone(state.layout);
    const activeTab = next.tabs.find((tab) => tab.id === state.activeTabId);
    activeTab.groups = activeTab.groups.filter((item) => item.id !== groupId);
    if (activeTab.groups.length === 0) {
      activeTab.groups.push({
        id: newId("group"),
        title: "Group",
        order: 0,
        items: []
      });
    }
    setLayout(next, true);
  }

  function addItem(groupId) {
    const group = findGroupById(groupId);
    if (!group) {
      return;
    }
    const label = promptText("Item label", "New Item");
    if (!label) {
      return;
    }
    const slotId = promptSlot(1, null);
    if (slotId === null) {
      return;
    }
    const icon = promptText("Icon id or URI", "symbol-method") || "symbol-method";
    const commandId = promptText("Command ID (optional)", "") || "";
    const shortcutLabel = promptText("Shortcut label (optional)", "") || "";

    const next = clone(state.layout);
    const activeTab = next.tabs.find((tab) => tab.id === state.activeTabId);
    const targetGroup = activeTab.groups.find((item) => item.id === groupId);
    targetGroup.items.push({
      id: newId("item"),
      slotId,
      label,
      icon,
      commandId,
      shortcutLabel
    });
    setLayout(next, true);
  }

  function editItem(itemId) {
    const item = getAllItems().find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }
    const label = promptText("Item label", item.label);
    if (!label) {
      return;
    }
    const slotId = promptSlot(item.slotId, item.id);
    if (slotId === null) {
      return;
    }
    const icon = promptText("Icon id or URI", item.icon) || item.icon;
    const commandId = promptText("Command ID", item.commandId) || "";
    const shortcutLabel = promptText("Shortcut label", item.shortcutLabel || "") || "";
    const tooltip = promptText("Tooltip (optional)", item.tooltip || "") || "";

    const next = clone(state.layout);
    next.tabs.forEach((tab) => {
      tab.groups.forEach((group) => {
        const target = group.items.find((entry) => entry.id === itemId);
        if (target) {
          target.label = label;
          target.slotId = slotId;
          target.icon = icon;
          target.commandId = commandId;
          target.shortcutLabel = shortcutLabel;
          target.tooltip = tooltip;
        }
      });
    });
    setLayout(next, true);
  }

  function moveItem(itemId, direction) {
    const next = clone(state.layout);
    for (const tab of next.tabs) {
      for (const group of tab.groups) {
        const index = group.items.findIndex((item) => item.id === itemId);
        const target = index + direction;
        if (index >= 0 && target >= 0 && target < group.items.length) {
          const temp = group.items[index];
          group.items[index] = group.items[target];
          group.items[target] = temp;
          setLayout(next, true);
          return;
        }
      }
    }
  }

  function deleteItem(itemId) {
    const next = clone(state.layout);
    for (const tab of next.tabs) {
      for (const group of tab.groups) {
        const currentLength = group.items.length;
        group.items = group.items.filter((item) => item.id !== itemId);
        if (group.items.length !== currentLength) {
          setLayout(next, true);
          return;
        }
      }
    }
  }

  function iconMarkup(icon) {
    const iconValue = (icon || "").trim();
    if (!iconValue) {
      return '<span class="item-icon-fallback">?</span>';
    }
    if (/^(https?:|data:|vscode-resource:|\/)/.test(iconValue)) {
      const isFontAwesomeSolid =
        /^https:\/\/cdn\.jsdelivr\.net\/npm\/@fortawesome\/fontawesome-free@6\.7\.2\/svgs\/solid\/.+\.svg$/i.test(iconValue);
      const imageClass = isFontAwesomeSolid ? "item-icon-image item-icon-image-mono" : "item-icon-image";
      return `<img class="${imageClass}" src="${escapeHtml(iconValue)}" alt="" />`;
    }
    if (/^[a-z0-9-]+$/i.test(iconValue)) {
      return `<span class="codicon codicon-${escapeHtml(iconValue)}" aria-hidden="true"></span>`;
    }
    const text = iconValue.slice(0, 1).toUpperCase() || "?";
    return `<span class="item-icon-fallback">${escapeHtml(text)}</span>`;
  }

  function renderToolbar() {
    const tabs = (state.layout?.tabs || []).slice().sort((a, b) => a.order - b.order);
    const ribbonEnabled = !!state.settings.enabled;
    const customizeClass = state.customizeMode ? "is-on" : "";
    const customizeDisabledAttr = ribbonEnabled ? "" : "disabled";
    const tabMarkup = tabs
      .map((tab) => {
        const active = tab.id === state.activeTabId ? "active" : "";
        return `<button class="tab-btn ${active}" data-action="select-tab" data-tab-id="${escapeHtml(tab.id)}">${escapeHtml(
          tab.title
        )}</button>`;
      })
      .join("");

    const customizeControls = state.customizeMode && ribbonEnabled
      ? `
      <div class="toolbar-row">
        <button data-action="add-tab">Add Tab</button>
        <button data-action="rename-tab">Rename Tab</button>
        <button data-action="move-tab-left">Move Tab Left</button>
        <button data-action="move-tab-right">Move Tab Right</button>
        <button data-action="delete-tab">Delete Tab</button>
        <button data-action="add-group">Add Group</button>
        <button data-action="reset-layout">Reset Layout</button>
      </div>`
      : "";

    toolbar.innerHTML = `
      <div class="toolbar-row">
        <button data-action="toggle-enabled">${ribbonEnabled ? "Disable Ribbon" : "Enable Ribbon"}</button>
        <button class="${customizeClass}" data-action="toggle-customize" ${customizeDisabledAttr}>${
          state.customizeMode ? "Exit Customize" : "Customize"
        }</button>
        <span class="toolbar-status">${ribbonEnabled ? "Enabled" : "Disabled"}</span>
      </div>
      <div class="tab-strip">${tabMarkup}</div>
      ${customizeControls}
    `;
  }

  function renderContent() {
    const activeTab = findActiveTab();
    if (!activeTab) {
      content.innerHTML = '<div class="empty">No tabs configured.</div>';
      return;
    }

    const groups = activeTab.groups.slice().sort((a, b) => a.order - b.order);
    content.innerHTML = groups
      .map((group) => {
        const items = group.items.slice();
        const itemMarkup = items
          .map((item) => {
            const ribbonDisabled = !state.settings.enabled;
            const unavailable = !!item.commandId && state.missingCommandIds.has(item.commandId);
            const isAssigned = !!item.commandId;
            const executeDisabled = ribbonDisabled || unavailable || !isAssigned;
            const titleText = ribbonDisabled
              ? "Ribbon is disabled."
              : item.tooltip || (unavailable ? `Missing command: ${item.commandId}` : item.commandId || "Unassigned");

            const customControls = state.customizeMode && !ribbonDisabled
              ? `
              <div class="item-controls">
                <button data-action="edit-item" data-item-id="${escapeHtml(item.id)}">Edit</button>
                <button data-action="move-item-left" data-item-id="${escapeHtml(item.id)}">Left</button>
                <button data-action="move-item-right" data-item-id="${escapeHtml(item.id)}">Right</button>
                <button data-action="assign-manual" data-slot-id="${item.slotId}">Manual</button>
                <button data-action="assign-palette" data-slot-id="${item.slotId}">Palette</button>
                <button data-action="clear-slot" data-slot-id="${item.slotId}">Clear</button>
                <button data-action="copy-snippet" data-slot-id="${item.slotId}">Snippet</button>
                <button data-action="delete-item" data-item-id="${escapeHtml(item.id)}">Delete</button>
              </div>`
              : "";

            const label = state.settings.showLabels
              ? `<span class="item-label">${escapeHtml(item.label)}</span>`
              : "";
            const shortcut = item.shortcutLabel
              ? `<span class="item-shortcut">${escapeHtml(item.shortcutLabel)}</span>`
              : "";
            const missingBadge = unavailable ? `<span class="item-missing">Missing</span>` : "";
            const disabledBadge = ribbonDisabled ? `<span class="item-disabled">Disabled</span>` : "";

            return `
              <div class="item-card ${unavailable ? "is-missing" : ""}">
                <button class="item-execute" data-action="execute-slot" data-slot-id="${item.slotId}" ${
                  executeDisabled ? "disabled" : ""
                } title="${escapeHtml(titleText)}">
                  <span class="item-icon">${iconMarkup(item.icon)}</span>
                  ${label}
                  ${shortcut}
                  <span class="item-slot">Slot ${String(item.slotId).padStart(3, "0")}</span>
                  ${missingBadge}
                  ${disabledBadge}
                </button>
                ${customControls}
              </div>
            `;
          })
          .join("");

        const groupControls = state.customizeMode && state.settings.enabled
          ? `
          <div class="group-controls">
            <button data-action="rename-group" data-group-id="${escapeHtml(group.id)}">Rename</button>
            <button data-action="move-group-left" data-group-id="${escapeHtml(group.id)}">Left</button>
            <button data-action="move-group-right" data-group-id="${escapeHtml(group.id)}">Right</button>
            <button data-action="delete-group" data-group-id="${escapeHtml(group.id)}">Delete</button>
            <button data-action="add-item" data-group-id="${escapeHtml(group.id)}">Add Item</button>
          </div>`
          : "";

        return `
          <section class="group">
            <header class="group-header">
              <h2>${escapeHtml(group.title)}</h2>
              ${groupControls}
            </header>
            <div class="group-items">${itemMarkup || '<div class="empty">No items.</div>'}</div>
          </section>
        `;
      })
      .join("");
  }

  function render() {
    if (!state.layout) {
      toolbar.innerHTML = "";
      content.innerHTML = '<div class="empty">Loading ribbon...</div>';
      return;
    }
    if (!state.settings.enabled && state.customizeMode) {
      state.customizeMode = false;
    }
    app.dataset.iconSize = state.settings.iconSize;
    app.dataset.compact = state.settings.compactMode ? "true" : "false";
    app.dataset.slotOutline = state.settings.slotShowOutline ? "true" : "false";
    app.dataset.enabled = state.settings.enabled ? "true" : "false";
    app.dataset.panelPosition = normalizePanelPosition(state.panelPosition);
    const slotMinWidth = clampedSlotMinWidth(state.settings.slotMinWidth);
    const slotMaxWidth = Math.max(slotMinWidth, clampedSlotMaxWidth(state.settings.slotMaxWidth));
    app.style.setProperty("--ribbon-slot-min-width", `${slotMinWidth}px`);
    app.style.setProperty("--ribbon-slot-max-width", `${slotMaxWidth}px`);
    renderToolbar();
    renderContent();
    vscode.setState({
      activeTabId: state.activeTabId
    });
  }

  function onToolbarAction(action, target) {
    switch (action) {
      case "toggle-enabled":
        send({ type: "toggleEnabled" });
        return true;
      case "toggle-customize":
        if (!state.settings.enabled) {
          return true;
        }
        send({ type: "toggleCustomizeMode" });
        return true;
      case "add-tab":
        if (!state.settings.enabled) {
          return true;
        }
        addTab();
        return true;
      case "rename-tab":
        if (!state.settings.enabled) {
          return true;
        }
        renameActiveTab();
        return true;
      case "move-tab-left":
        if (!state.settings.enabled) {
          return true;
        }
        moveActiveTab(-1);
        return true;
      case "move-tab-right":
        if (!state.settings.enabled) {
          return true;
        }
        moveActiveTab(1);
        return true;
      case "delete-tab":
        if (!state.settings.enabled) {
          return true;
        }
        deleteActiveTab();
        return true;
      case "add-group":
        if (!state.settings.enabled) {
          return true;
        }
        addGroup();
        return true;
      case "reset-layout":
        if (!state.settings.enabled) {
          return true;
        }
        if (window.confirm("Reset layout to default starter tabs?")) {
          send({ type: "resetLayout" });
        }
        return true;
      case "select-tab":
        state.activeTabId = target.dataset.tabId;
        render();
        return true;
      default:
        return false;
    }
  }

  function onContentAction(action, target) {
    const groupId = target.dataset.groupId;
    const itemId = target.dataset.itemId;
    const slotId = Number(target.dataset.slotId);

    switch (action) {
      case "rename-group":
        if (!state.settings.enabled) {
          return true;
        }
        renameGroup(groupId);
        return true;
      case "move-group-left":
        if (!state.settings.enabled) {
          return true;
        }
        moveGroup(groupId, -1);
        return true;
      case "move-group-right":
        if (!state.settings.enabled) {
          return true;
        }
        moveGroup(groupId, 1);
        return true;
      case "delete-group":
        if (!state.settings.enabled) {
          return true;
        }
        deleteGroup(groupId);
        return true;
      case "add-item":
        if (!state.settings.enabled) {
          return true;
        }
        addItem(groupId);
        return true;
      case "execute-slot":
        send({ type: "executeSlot", slotId });
        return true;
      case "edit-item":
        if (!state.settings.enabled) {
          return true;
        }
        editItem(itemId);
        return true;
      case "move-item-left":
        if (!state.settings.enabled) {
          return true;
        }
        moveItem(itemId, -1);
        return true;
      case "move-item-right":
        if (!state.settings.enabled) {
          return true;
        }
        moveItem(itemId, 1);
        return true;
      case "delete-item":
        if (!state.settings.enabled) {
          return true;
        }
        deleteItem(itemId);
        return true;
      case "assign-manual":
        if (!state.settings.enabled) {
          return true;
        }
        send({ type: "assignSlotManual", slotId });
        return true;
      case "assign-palette":
        if (!state.settings.enabled) {
          return true;
        }
        send({ type: "assignSlotFromPalette", slotId });
        return true;
      case "clear-slot":
        if (!state.settings.enabled) {
          return true;
        }
        send({ type: "clearSlot", slotId });
        return true;
      case "copy-snippet":
        send({ type: "copySnippet", slotId });
        return true;
      default:
        return false;
    }
  }

  app.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    if (onToolbarAction(action, target)) {
      return;
    }
    onContentAction(action, target);
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "state") {
      return;
    }
    state.layout = message.state.layout;
    state.settings = message.state.settings || state.settings;
    state.customizeMode = !!message.state.customizeMode;
    state.slotCount = Number(message.state.slotCount) || state.slotCount;
    state.missingCommandIds = new Set(message.state.missingCommandIds || []);
    state.panelPosition = normalizePanelPosition(message.state.panelPosition);

    const previous = vscode.getState();
    if (previous && typeof previous.activeTabId === "string") {
      state.activeTabId = previous.activeTabId;
    }
    ensureActiveTab();
    render();
  });

  send({ type: "ready" });
})();
