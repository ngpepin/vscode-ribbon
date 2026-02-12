import * as vscode from "vscode";
import { CONTROL_VIEW_ID, CORE_COMMANDS, VIEW_ID } from "./constants";
import { CommandCaptureService } from "./services/commandCaptureService";
import { RibbonLogger } from "./services/logger";
import { RibbonConfigService } from "./services/ribbonConfigService";
import { RibbonViewProvider } from "./services/ribbonViewProvider";
import { ActionExecutor } from "./services/actionExecutor";
import { SlotCommandService } from "./services/slotCommandService";
import { RibbonControlViewProvider } from "./services/ribbonControlViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const startedAt = Date.now();
  const logger = new RibbonLogger();
  const configService = new RibbonConfigService(logger);
  const actionExecutor = new ActionExecutor(logger, configService);
  const captureService = new CommandCaptureService(logger, configService);
  const viewProvider = new RibbonViewProvider(
    context.extensionUri,
    configService,
    actionExecutor,
    captureService,
    logger
  );
  const slotCommandService = new SlotCommandService(configService, actionExecutor);
  const controlViewProvider = new RibbonControlViewProvider(configService);

  context.subscriptions.push(logger, configService, captureService, viewProvider, controlViewProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, viewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }),
    vscode.window.registerTreeDataProvider(CONTROL_VIEW_ID, controlViewProvider)
  );

  slotCommandService.register(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(CORE_COMMANDS.focus, () => viewProvider.focus()),
    vscode.commands.registerCommand(CORE_COMMANDS.toggleEnabled, () => viewProvider.toggleEnabled()),
    vscode.commands.registerCommand(CORE_COMMANDS.toggleCustomizeMode, () => viewProvider.toggleCustomizeMode()),
    vscode.commands.registerCommand(CORE_COMMANDS.assignSlotFromPalette, (slotId?: unknown) =>
      viewProvider.assignSlotFromPalette(slotId)
    ),
    vscode.commands.registerCommand(CORE_COMMANDS.assignSlotManual, (slotId?: unknown) =>
      viewProvider.assignSlotManual(slotId)
    ),
    vscode.commands.registerCommand(CORE_COMMANDS.clearSlot, (slotId?: unknown) => viewProvider.clearSlot(slotId)),
    vscode.commands.registerCommand(CORE_COMMANDS.copyKeybindingSnippet, (slotId?: unknown) =>
      viewProvider.copyKeybindingSnippet(slotId)
    ),
    vscode.commands.registerCommand(CORE_COMMANDS.setWriteTargetUser, async () => {
      await configService.setWriteTarget("user");
      void vscode.window.showInformationMessage("VS Code Ribbon: Write target set to User settings.");
    }),
    vscode.commands.registerCommand(CORE_COMMANDS.setWriteTargetWorkspace, async () => {
      await configService.setWriteTarget("workspace");
      void vscode.window.showInformationMessage("VS Code Ribbon: Write target set to Workspace settings.");
    }),
    vscode.commands.registerCommand(CORE_COMMANDS.exportLayout, () => exportLayout(configService, logger)),
    vscode.commands.registerCommand(CORE_COMMANDS.importLayout, async () => {
      await importLayout(configService, logger);
    })
  );

  logger.info(`Extension activated in ${Date.now() - startedAt}ms.`);
}

export function deactivate(): void {}

async function exportLayout(configService: RibbonConfigService, logger: RibbonLogger): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    title: "Export Ribbon Layout",
    filters: {
      JSON: ["json"]
    },
    saveLabel: "Export"
  });
  if (!uri) {
    return;
  }
  const layout = configService.getLayout();
  const contents = Buffer.from(`${JSON.stringify(layout, null, 2)}\n`, "utf8");
  await vscode.workspace.fs.writeFile(uri, contents);
  logger.info(`Layout exported: ${uri.toString()}`);
  void vscode.window.showInformationMessage("VS Code Ribbon: Layout exported.");
}

async function importLayout(configService: RibbonConfigService, logger: RibbonLogger): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    title: "Import Ribbon Layout",
    canSelectMany: false,
    openLabel: "Import",
    filters: {
      JSON: ["json"]
    }
  });
  if (!selected?.length) {
    return;
  }
  const target = selected[0];
  try {
    const contents = await vscode.workspace.fs.readFile(target);
    const json = JSON.parse(Buffer.from(contents).toString("utf8"));
    await configService.updateLayoutFromUnknown(json);
    logger.info(`Layout imported: ${target.toString()}`);
    void vscode.window.showInformationMessage("VS Code Ribbon: Layout imported.");
  } catch (error) {
    logger.error("Import layout failed.", error);
    void vscode.window.showErrorMessage("VS Code Ribbon: Failed to import layout JSON.");
  }
}
