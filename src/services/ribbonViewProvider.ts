import * as vscode from "vscode";
import { slotCommandId, VIEW_ID } from "../constants";
import { assignCommandToSlot, clearSlot, createDefaultLayout, createId, normalizeLooseLayout } from "../model/layoutModel";
import { RibbonLayout, SLOT_COUNT } from "../model/types";
import { ActionExecutor } from "./actionExecutor";
import { CommandCaptureService } from "./commandCaptureService";
import { RibbonConfigService } from "./ribbonConfigService";
import { RibbonLogger } from "./logger";

interface IncomingMessage {
  type: string;
  slotId?: number;
  layout?: unknown;
}

type PanelPosition = "top" | "bottom" | "left" | "right";
type CommandExecuteEvent = { command: string; arguments?: unknown[] };
type CommandsWithEvent = typeof vscode.commands & {
  onDidExecuteCommand?: (listener: (event: CommandExecuteEvent) => unknown) => vscode.Disposable;
};

const PANEL_POSITION_COMMANDS = new Set<string>([
  "workbench.action.positionPanelTop",
  "workbench.action.positionPanelBottom",
  "workbench.action.positionPanelLeft",
  "workbench.action.positionPanelRight"
]);

function isPanelPosition(value: unknown): value is PanelPosition {
  return value === "top" || value === "bottom" || value === "left" || value === "right";
}

export class RibbonViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private customizeMode = false;
  private panelPosition: PanelPosition = "bottom";
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly configService: RibbonConfigService,
    private readonly actionExecutor: ActionExecutor,
    private readonly captureService: CommandCaptureService,
    private readonly logger: RibbonLogger
  ) {
    this.disposables.push(
      this.configService.onDidChange(() => {
        void this.publishState();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("workbench.panel.defaultLocation")) {
          void this.refreshPanelPosition(true);
        }
      })
    );
    this.registerPanelPositionListeners();
    void this.refreshPanelPosition(false);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        vscode.Uri.joinPath(this.extensionUri, "node_modules", "@vscode", "codicons", "dist")
      ]
    };
    view.webview.html = this.getHtml(view.webview);

    this.disposables.push(
      view.onDidDispose(() => {
        this.view = undefined;
      }),
      view.webview.onDidReceiveMessage((message) => {
        void this.handleMessage(message as IncomingMessage);
      })
    );

    await this.refreshPanelPosition(false);
    await this.publishState(true);
  }

  async focus(): Promise<void> {
    if (this.view) {
      this.view.show?.(false);
      return;
    }
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  async toggleEnabled(): Promise<void> {
    const currentlyEnabled = this.configService.getSettings().enabled;
    await this.configService.setEnabled(!currentlyEnabled);
    if (currentlyEnabled && this.customizeMode) {
      this.customizeMode = false;
      await vscode.commands.executeCommand("setContext", "vscodeRibbon.customizeMode", false);
    }
    void vscode.window.showInformationMessage(`VS Code Ribbon: ${currentlyEnabled ? "Disabled" : "Enabled"}.`);
    await this.publishState();
  }

  async toggleCustomizeMode(): Promise<void> {
    if (!this.ensureEnabled("toggle customize mode")) {
      return;
    }
    this.customizeMode = !this.customizeMode;
    await vscode.commands.executeCommand("setContext", "vscodeRibbon.customizeMode", this.customizeMode);
    await this.publishState();
  }

  async assignSlotFromPalette(slotIdArg?: unknown): Promise<void> {
    if (!this.ensureEnabled("assign commands")) {
      return;
    }
    const slotId = await this.resolveSlotId(slotIdArg);
    if (!slotId) {
      return;
    }
    await this.captureService.captureFromPalette(slotId, async (commandId) => {
      await this.assignCommandToSlot(slotId, commandId.commandId, {
        args: commandId.args
      });
    });
  }

  async assignSlotManual(slotIdArg?: unknown): Promise<void> {
    if (!this.ensureEnabled("assign commands")) {
      return;
    }
    const slotId = await this.resolveSlotId(slotIdArg);
    if (!slotId) {
      return;
    }

    const commandId = await vscode.window.showInputBox({
      title: "Assign Ribbon Slot Command",
      prompt: `Enter command ID for slot ${String(slotId).padStart(3, "0")}`,
      validateInput: (value) => (value.trim().length > 0 ? undefined : "Command ID is required.")
    });
    if (!commandId) {
      return;
    }

    const label = await vscode.window.showInputBox({
      title: "Ribbon Item Label",
      prompt: "Optional label shown on the icon",
      value: this.deriveLabel(commandId)
    });

    const shortcutLabel = await vscode.window.showInputBox({
      title: "Shortcut Label",
      prompt: "Optional manual shortcut label (for display only)",
      placeHolder: "Ctrl+Alt+1"
    });

    const available = await this.actionExecutor.isCommandAvailable(commandId);
    if (!available) {
      this.logger.warn(`Manual assignment uses currently unavailable command: ${commandId}`);
      void vscode.window.showWarningMessage(
        `VS Code Ribbon: '${commandId}' is not currently registered. The icon will be disabled until available.`
      );
    }

    await this.assignCommandToSlot(slotId, commandId, {
      label: label?.trim() || this.deriveLabel(commandId),
      shortcutLabel: shortcutLabel?.trim() || undefined
    });
  }

  async clearSlot(slotIdArg?: unknown): Promise<void> {
    if (!this.ensureEnabled("clear slots")) {
      return;
    }
    const slotId = await this.resolveSlotId(slotIdArg);
    if (!slotId) {
      return;
    }
    const nextLayout = clearSlot(this.configService.getLayout(), slotId);
    await this.configService.updateLayout(nextLayout);
    await this.publishState();
  }

  async copyKeybindingSnippet(slotIdArg?: unknown): Promise<void> {
    const slotId = await this.resolveSlotId(slotIdArg);
    if (!slotId) {
      return;
    }
    const snippet = {
      key: "ctrl+alt+1",
      command: slotCommandId(slotId),
      when: "editorTextFocus"
    };
    await vscode.env.clipboard.writeText(JSON.stringify(snippet, null, 2));
    void vscode.window.showInformationMessage(
      `VS Code Ribbon: Keybinding snippet for slot ${String(slotId).padStart(3, "0")} copied to clipboard.`
    );
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    if (!message || typeof message.type !== "string") {
      return;
    }
    switch (message.type) {
      case "ready":
        await this.publishState(true);
        return;
      case "toggleEnabled":
        await this.toggleEnabled();
        return;
      case "toggleCustomizeMode":
        await this.toggleCustomizeMode();
        return;
      case "executeSlot":
        if (typeof message.slotId === "number") {
          await vscode.commands.executeCommand(slotCommandId(message.slotId));
        }
        return;
      case "saveLayout":
        if (message.layout) {
          if (!this.configService.getSettings().enabled) {
            void vscode.window.showInformationMessage("VS Code Ribbon is disabled.");
            return;
          }
          await this.configService.updateLayoutFromUnknown(message.layout);
          await this.publishState();
        }
        return;
      case "assignSlotFromPalette":
        await this.assignSlotFromPalette(message.slotId);
        return;
      case "assignSlotManual":
        await this.assignSlotManual(message.slotId);
        return;
      case "clearSlot":
        await this.clearSlot(message.slotId);
        return;
      case "copySnippet":
        await this.copyKeybindingSnippet(message.slotId);
        return;
      case "resetLayout":
        await this.configService.updateLayout(createDefaultLayout());
        await this.publishState();
        return;
      default:
        this.logger.warn(`Unknown webview message: ${message.type}`);
    }
  }

  private async publishState(forceRefreshCommands = false): Promise<void> {
    if (!this.view) {
      return;
    }

    const rawLayout = this.configService.getLayout();
    const layout = normalizeLooseLayout(rawLayout);
    const settings = this.configService.getSettings();
    if (!settings.enabled && this.customizeMode) {
      this.customizeMode = false;
      await vscode.commands.executeCommand("setContext", "vscodeRibbon.customizeMode", false);
    }
    const availableCommands = await this.actionExecutor.getAvailableCommands(forceRefreshCommands);
    const renderLayout: RibbonLayout = {
      ...layout,
      tabs: layout.tabs.map((tab) => ({
        ...tab,
        groups: tab.groups.map((group) => ({
          ...group,
          items: group.items.map((item) => ({
            ...item,
            commandId: item.commandId ?? "",
            tooltip: item.tooltip ?? "",
            shortcutLabel: item.shortcutLabel ?? ""
          }))
        }))
      }))
    };

    const missingCommandIds = Array.from(
      new Set(
        renderLayout.tabs
          .flatMap((tab) => tab.groups)
          .flatMap((group) => group.items)
          .filter((item) => item.commandId && !availableCommands.has(item.commandId))
          .map((item) => item.commandId)
      )
    );

    await this.view.webview.postMessage({
      type: "state",
      state: {
        layout: renderLayout,
        settings,
        customizeMode: this.customizeMode,
        slotCount: SLOT_COUNT,
        missingCommandIds,
        panelPosition: this.panelPosition
      }
    });
  }

  private async assignCommandToSlot(
    slotId: number,
    commandId: string,
    options?: { label?: string; shortcutLabel?: string; args?: unknown[] }
  ): Promise<void> {
    const current = this.configService.getLayout();
    const next = assignCommandToSlot(current, slotId, commandId, {
      label: options?.label || this.deriveLabel(commandId),
      shortcutLabel: options?.shortcutLabel,
      args: options?.args
    });
    await this.configService.updateLayout(next);
    await this.publishState();
  }

  private async resolveSlotId(slotIdArg: unknown): Promise<number | undefined> {
    if (typeof slotIdArg === "number" && slotIdArg >= 1 && slotIdArg <= SLOT_COUNT) {
      return Math.round(slotIdArg);
    }
    const input = await vscode.window.showInputBox({
      title: "Ribbon Slot",
      prompt: `Choose a slot number (1-${SLOT_COUNT})`,
      placeHolder: "42",
      validateInput: (value) => {
        const asNumber = Number(value);
        if (!Number.isInteger(asNumber) || asNumber < 1 || asNumber > SLOT_COUNT) {
          return `Enter an integer between 1 and ${SLOT_COUNT}.`;
        }
        return undefined;
      }
    });
    if (!input) {
      return undefined;
    }
    return Number(input);
  }

  private deriveLabel(commandId: string): string {
    const lastToken = commandId.split(".").pop() || commandId;
    return lastToken
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private ensureEnabled(actionDescription: string): boolean {
    if (this.configService.getSettings().enabled) {
      return true;
    }
    void vscode.window.showInformationMessage(`VS Code Ribbon is disabled. Enable it first to ${actionDescription}.`);
    return false;
  }

  private registerPanelPositionListeners(): void {
    const commandsApi = vscode.commands as CommandsWithEvent;
    if (!commandsApi.onDidExecuteCommand) {
      return;
    }
    this.disposables.push(
      commandsApi.onDidExecuteCommand((event: CommandExecuteEvent) => {
        if (PANEL_POSITION_COMMANDS.has(event.command)) {
          void this.refreshPanelPosition(true);
        }
      })
    );
  }

  private async refreshPanelPosition(publishOnChange: boolean): Promise<void> {
    const next = await this.detectPanelPosition();
    if (next === this.panelPosition) {
      return;
    }
    this.panelPosition = next;
    if (publishOnChange) {
      await this.publishState();
    }
  }

  private async detectPanelPosition(): Promise<PanelPosition> {
    const contextPosition = await this.readPanelPositionFromContext();
    if (contextPosition) {
      return contextPosition;
    }
    const configured = vscode.workspace.getConfiguration("workbench").get<string>("panel.defaultLocation", "bottom");
    return isPanelPosition(configured) ? configured : "bottom";
  }

  private async readPanelPositionFromContext(): Promise<PanelPosition | undefined> {
    try {
      const value = await vscode.commands.executeCommand<unknown>("getContextKeyValue", "panelPosition");
      return isPanelPosition(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.css"));
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css")
    );
    const nonce = createId("nonce");
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${codiconUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>VS Code Ribbon</title>
</head>
<body>
  <div id="app">
    <header id="ribbon-toolbar"></header>
    <main id="ribbon-content"></main>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
