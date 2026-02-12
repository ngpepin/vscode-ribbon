import * as vscode from "vscode";
import { slotCommandId } from "../constants";
import { getItemBySlot } from "../model/layoutModel";
import { SLOT_COUNT } from "../model/types";
import { ActionExecutor } from "./actionExecutor";
import { RibbonConfigService } from "./ribbonConfigService";

export class SlotCommandService {
  constructor(
    private readonly configService: RibbonConfigService,
    private readonly actionExecutor: ActionExecutor
  ) {}

  register(context: vscode.ExtensionContext): void {
    for (let slotId = 1; slotId <= SLOT_COUNT; slotId += 1) {
      const commandId = slotCommandId(slotId);
      context.subscriptions.push(
        vscode.commands.registerCommand(commandId, async () => {
          await this.executeSlot(slotId);
        })
      );
    }
  }

  async executeSlot(slotId: number): Promise<boolean> {
    if (!this.configService.getSettings().enabled) {
      void vscode.window.showInformationMessage("VS Code Ribbon is disabled.");
      return false;
    }

    const layout = this.configService.getLayout();
    const item = getItemBySlot(layout, slotId);
    if (!item || !item.commandId) {
      void vscode.window.showInformationMessage(
        `VS Code Ribbon: Slot ${String(slotId).padStart(3, "0")} is not assigned.`
      );
      return false;
    }
    return this.actionExecutor.executeItem(item);
  }
}
