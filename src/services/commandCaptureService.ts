import * as vscode from "vscode";
import { RibbonConfigService } from "./ribbonConfigService";
import { RibbonLogger } from "./logger";

type CapturedCommand = {
  commandId: string;
  args?: unknown[];
};

type CaptureHandler = (captured: CapturedCommand) => Promise<void>;
type CommandExecuteEvent = { command: string; arguments?: unknown[] };
type CommandsWithEvent = typeof vscode.commands & {
  onDidExecuteCommand?: (listener: (event: CommandExecuteEvent) => unknown) => vscode.Disposable;
};

const PALETTE_WRAPPER_COMMANDS = new Set<string>([
  "workbench.action.showCommands",
  "workbench.action.quickOpen",
  "workbench.action.acceptSelectedQuickOpenItem",
  "workbench.action.closeQuickOpen",
  "workbench.action.quickInputBack",
  "setContext"
]);

export class CommandCaptureService implements vscode.Disposable {
  private captureDisposable: vscode.Disposable | undefined;
  private captureTimeout: NodeJS.Timeout | undefined;
  private isCapturing = false;

  constructor(
    private readonly logger: RibbonLogger,
    private readonly configService: RibbonConfigService
  ) {}

  dispose(): void {
    this.stopCapture();
  }

  async captureFromPalette(slotId: number, onCaptured: CaptureHandler): Promise<CapturedCommand | undefined> {
    if (this.isCapturing) {
      void vscode.window.showWarningMessage("VS Code Ribbon: Command capture is already in progress.");
      return undefined;
    }

    this.isCapturing = true;
    void vscode.window.showInformationMessage(
      `VS Code Ribbon: Choose a command from the palette to assign to slot ${String(slotId).padStart(3, "0")}.`
    );

    return new Promise<CapturedCommand | undefined>((resolve) => {
      const commandsApi = vscode.commands as CommandsWithEvent;
      if (!commandsApi.onDidExecuteCommand) {
        this.logger.warn("onDidExecuteCommand is unavailable in this VS Code runtime.");
        void vscode.window.showWarningMessage(
          "VS Code Ribbon: Command capture from palette is unavailable in this VS Code build. Use manual assignment."
        );
        this.isCapturing = false;
        resolve(undefined);
        return;
      }

      const finish = async (captured?: CapturedCommand): Promise<void> => {
        this.stopCapture();
        this.isCapturing = false;
        if (!captured) {
          resolve(undefined);
          return;
        }
        try {
          await onCaptured(captured);
          resolve(captured);
        } catch (error) {
          this.logger.error("Failed to apply captured command to slot.", error);
          void vscode.window.showErrorMessage("VS Code Ribbon: Failed to assign captured command.");
          resolve(undefined);
        }
      };

      this.captureDisposable = commandsApi.onDidExecuteCommand(async (event: CommandExecuteEvent) => {
        if (this.shouldIgnoreCommand(event.command)) {
          return;
        }
        await finish({
          commandId: event.command,
          args: Array.isArray(event.arguments) ? event.arguments : undefined
        });
      });

      this.captureTimeout = setTimeout(() => {
        void vscode.window.showInformationMessage("VS Code Ribbon: Command capture timed out.");
        void finish(undefined);
      }, 60_000);

      void vscode.commands
        .executeCommand("workbench.action.showCommands")
        .then(undefined, async (error: unknown) => {
          this.logger.error("Failed to open command palette for capture.", error);
          await finish(undefined);
        });
    });
  }

  private stopCapture(): void {
    if (this.captureDisposable) {
      this.captureDisposable.dispose();
      this.captureDisposable = undefined;
    }
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = undefined;
    }
  }

  private shouldIgnoreCommand(commandId: string): boolean {
    if (!commandId) {
      return true;
    }
    if (commandId.startsWith("vscodeRibbon.")) {
      return true;
    }

    const settings = this.configService.getSettings();
    if (settings.capturePaletteWrapperCommands) {
      return false;
    }

    if (commandId.startsWith("workbench.action.quickOpen")) {
      return true;
    }

    return PALETTE_WRAPPER_COMMANDS.has(commandId);
  }
}
