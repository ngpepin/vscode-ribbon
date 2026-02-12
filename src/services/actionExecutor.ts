import * as vscode from "vscode";
import { RibbonItem } from "../model/types";
import { RibbonLogger } from "./logger";
import { RibbonConfigService } from "./ribbonConfigService";

export class ActionExecutor {
  private commandCache = new Set<string>();
  private lastRefresh = 0;

  constructor(
    private readonly logger: RibbonLogger,
    private readonly configService: RibbonConfigService
  ) {}

  async getAvailableCommands(forceRefresh = false): Promise<Set<string>> {
    const now = Date.now();
    if (!forceRefresh && now - this.lastRefresh < 5_000 && this.commandCache.size > 0) {
      return this.commandCache;
    }
    const commands = await vscode.commands.getCommands(false);
    this.commandCache = new Set(commands);
    this.lastRefresh = now;
    return this.commandCache;
  }

  async isCommandAvailable(commandId: string): Promise<boolean> {
    if (!commandId) {
      return false;
    }
    const commands = await this.getAvailableCommands();
    return commands.has(commandId);
  }

  async executeItem(item: RibbonItem): Promise<boolean> {
    if (!this.configService.getSettings().enabled) {
      void vscode.window.showInformationMessage("VS Code Ribbon is disabled.");
      return false;
    }

    if (!item.commandId) {
      void vscode.window.showInformationMessage(`VS Code Ribbon: Slot ${item.slotId} is not assigned.`);
      return false;
    }

    try {
      await vscode.commands.executeCommand(item.commandId, ...(item.args ?? []));
      if (this.shouldAutoAcceptCommandPaletteSelection(item)) {
        await this.acceptSelectedQuickPick();
      }
      return true;
    } catch (error) {
      this.logger.error(`Command execution failed: ${item.commandId}`, error);
      void vscode.window.showErrorMessage(`VS Code Ribbon: Failed to execute command '${item.commandId}'.`);
      return false;
    }
  }

  private shouldAutoAcceptCommandPaletteSelection(item: RibbonItem): boolean {
    const settings = this.configService.getSettings();
    if (!settings.autoAcceptCommandPaletteSelection) {
      return false;
    }

    if (item.commandId !== "workbench.action.quickOpen") {
      return false;
    }

    const firstArg = item.args?.[0];
    if (typeof firstArg !== "string") {
      return false;
    }

    // Command-palette mode in quickOpen starts with '>' query text.
    return firstArg.trim().startsWith(">");
  }

  private async acceptSelectedQuickPick(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 20);
      });
      await vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
    } catch (error) {
      this.logger.warn(`Auto-accept of quick pick failed: ${String(error)}`);
    }
  }
}
