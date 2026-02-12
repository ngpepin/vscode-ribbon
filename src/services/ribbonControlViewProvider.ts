import * as vscode from "vscode";
import { CORE_COMMANDS } from "../constants";
import { RibbonConfigService } from "./ribbonConfigService";

export class RibbonControlViewProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly configService: RibbonConfigService) {
    this.disposables.push(
      this.configService.onDidChange(() => {
        this.onDidChangeTreeDataEmitter.fire();
      })
    );
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.onDidChangeTreeDataEmitter.dispose();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    const enabled = this.configService.getSettings().enabled;
    const toggleItem = new vscode.TreeItem(
      enabled ? "Disable Ribbon" : "Enable Ribbon",
      vscode.TreeItemCollapsibleState.None
    );
    toggleItem.id = "vscodeRibbon.control.toggle";
    toggleItem.description = enabled ? "Currently enabled" : "Currently disabled";
    toggleItem.tooltip = enabled
      ? "Disable ribbon UI interactions and slot execution."
      : "Enable ribbon UI interactions and slot execution.";
    toggleItem.iconPath = new vscode.ThemeIcon(enabled ? "eye-closed" : "eye");
    toggleItem.command = {
      command: CORE_COMMANDS.toggleEnabled,
      title: enabled ? "Disable Ribbon" : "Enable Ribbon"
    };

    const focusItem = new vscode.TreeItem("Focus Ribbon Panel", vscode.TreeItemCollapsibleState.None);
    focusItem.id = "vscodeRibbon.control.focus";
    focusItem.description = "Open panel";
    focusItem.iconPath = new vscode.ThemeIcon("layout-panel");
    focusItem.command = {
      command: CORE_COMMANDS.focus,
      title: "Focus Ribbon"
    };

    return [toggleItem, focusItem];
  }
}

