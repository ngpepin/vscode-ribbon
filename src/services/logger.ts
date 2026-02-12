import * as vscode from "vscode";

export class RibbonLogger implements vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel("VS Code Ribbon");

  info(message: string): void {
    this.channel.appendLine(`[INFO] ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[WARN] ${message}`);
  }

  error(message: string, error?: unknown): void {
    const details = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error ?? "");
    this.channel.appendLine(`[ERROR] ${message}${details ? `\n${details}` : ""}`);
  }

  dispose(): void {
    this.channel.dispose();
  }
}

