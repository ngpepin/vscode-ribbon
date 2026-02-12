import * as vscode from "vscode";
import { EXTENSION_NAMESPACE } from "../constants";
import {
  createDefaultLayout,
  normalizeLooseLayout,
  parseLayoutOrDefault,
  validateLayout
} from "../model/layoutModel";
import { RibbonLayout, RibbonSettings } from "../model/types";
import { RibbonLogger } from "./logger";

type WriteTarget = RibbonSettings["writeTarget"];

function clampSlotMaxWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return 280;
  }
  return Math.max(140, Math.min(640, Math.round(width)));
}

function clampSlotMinWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return 112;
  }
  return Math.max(72, Math.min(400, Math.round(width)));
}

export class RibbonConfigService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly logger: RibbonLogger) {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(EXTENSION_NAMESPACE)) {
          this.onDidChangeEmitter.fire();
        }
      })
    );
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.onDidChangeEmitter.dispose();
  }

  getSettings(): RibbonSettings {
    const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);
    const slotMinWidth = clampSlotMinWidth(configuration.get<number>("slotMinWidth", 112));
    const slotMaxWidth = Math.max(slotMinWidth, clampSlotMaxWidth(configuration.get<number>("slotMaxWidth", 280)));
    return {
      enabled: configuration.get<boolean>("enabled", true),
      showLabels: configuration.get<boolean>("showLabels", true),
      iconSize: configuration.get<RibbonSettings["iconSize"]>("iconSize", "medium"),
      compactMode: configuration.get<boolean>("compactMode", false),
      slotMinWidth,
      slotMaxWidth,
      slotShowOutline: configuration.get<boolean>("slotShowOutline", false),
      writeTarget: configuration.get<WriteTarget>("writeTarget", "workspace"),
      autoAcceptCommandPaletteSelection: configuration.get<boolean>("autoAcceptCommandPaletteSelection", true),
      capturePaletteWrapperCommands: configuration.get<boolean>("capturePaletteWrapperCommands", false)
    };
  }

  getLayout(): RibbonLayout {
    const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);
    const rawLayout = configuration.get<unknown>("layout", createDefaultLayout());
    const parsed = parseLayoutOrDefault(rawLayout);
    if (parsed.usedDefault) {
      this.logger.warn(`Falling back to default layout. ${parsed.error ?? "Unknown validation error."}`);
    }
    return parsed.layout;
  }

  async updateLayout(layout: RibbonLayout, explicitTarget?: WriteTarget): Promise<void> {
    const validation = validateLayout(layout);
    if (!validation.ok) {
      throw new Error(`Cannot save invalid layout: ${validation.error}`);
    }
    const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);
    const target = this.resolveConfigurationTarget(explicitTarget ?? this.getSettings().writeTarget);
    await configuration.update("layout", validation.layout, target);
  }

  async updateLayoutFromUnknown(layout: unknown, explicitTarget?: WriteTarget): Promise<RibbonLayout> {
    const loose = normalizeLooseLayout(layout);
    await this.updateLayout(loose, explicitTarget);
    return loose;
  }

  async setWriteTarget(target: WriteTarget): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);
    await configuration.update("writeTarget", target, vscode.ConfigurationTarget.Global);
  }

  async setEnabled(enabled: boolean, explicitTarget?: WriteTarget): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);
    const target = this.resolveConfigurationTarget(explicitTarget ?? this.getSettings().writeTarget);
    await configuration.update("enabled", enabled, target);
  }

  private resolveConfigurationTarget(target: WriteTarget): vscode.ConfigurationTarget {
    if (target === "workspace") {
      if (vscode.workspace.workspaceFolders?.length) {
        return vscode.ConfigurationTarget.Workspace;
      }
      this.logger.warn("Workspace write target requested without workspace folder. Falling back to user target.");
      void vscode.window.showWarningMessage(
        "VS Code Ribbon: No workspace folder is open. Layout was saved to User settings."
      );
      return vscode.ConfigurationTarget.Global;
    }
    return vscode.ConfigurationTarget.Global;
  }
}
