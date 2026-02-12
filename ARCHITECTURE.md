# VS Code Ribbon Architecture

## System Overview
VS Code Ribbon is a desktop-first VS Code extension that renders a tabbed ribbon in a custom panel view container and maps ribbon slots to executable VS Code commands.

The architecture is split into two runtimes:
- Extension host (TypeScript in `src/`): command registration, config persistence, execution, webview state orchestration.
- Webview UI (JavaScript/CSS in `media/`): tab/group/item rendering, customize UX, host message bridge.

## Extension Surfaces
- View container: `vscodeRibbon` in `contributes.viewsContainers.panel`
- Webview view: `vscodeRibbon.view` in `contributes.views`
- Core commands:
- `vscodeRibbon.focus`, `vscodeRibbon.toggleCustomizeMode`, `vscodeRibbon.assignSlotFromPalette`, `vscodeRibbon.assignSlotManual`, `vscodeRibbon.clearSlot`, `vscodeRibbon.exportLayout`, `vscodeRibbon.importLayout`, `vscodeRibbon.setWriteTargetUser`, `vscodeRibbon.setWriteTargetWorkspace`, `vscodeRibbon.copyKeybindingSnippet`
- Slot commands: static contributions `vscodeRibbon.slot001` ... `vscodeRibbon.slot128`
- Settings (`vscodeRibbon.*`):
- `layout`, `writeTarget`, `showLabels`, `iconSize`, `compactMode`, `slotMinWidth`, `slotMaxWidth`, `slotShowOutline`, `autoAcceptCommandPaletteSelection`, `capturePaletteWrapperCommands`

## Core Components
1. `src/extension.ts`
- Activates services and registers the webview provider.
- Registers all core commands.
- Registers runtime slot command handlers through `SlotCommandService`.
- Implements layout export/import commands.
2. `src/services/ribbonViewProvider.ts`
- Owns `WebviewView` lifecycle and HTML/CSP bootstrap.
- Handles inbound messages from the webview and dispatches actions.
- Publishes normalized layout + settings + missing-command metadata to the UI.
3. `src/services/ribbonConfigService.ts`
- Reads settings and layout from `vscode.workspace.getConfiguration("vscodeRibbon")`.
- Validates and normalizes layout writes.
- Resolves write target (`workspace` vs `user`) with workspace fallback behavior.
4. `src/services/actionExecutor.ts`
- Caches available command IDs (`commands.getCommands(false)`).
- Executes assigned commands and returns success/failure.
- Supports optional auto-accept for command-palette quickOpen query flows.
5. `src/services/commandCaptureService.ts`
- Starts capture mode, launches command palette, and listens for executed commands.
- Ignores wrapper/internal commands by default.
- Emits first captured command ID (+ optional args) back to caller.
6. `src/services/slotCommandService.ts`
- Registers handlers for all slots `1..128`.
- Resolves slot to layout item and executes via `ActionExecutor`.
7. `src/model/layoutModel.ts`
- Defines default starter layout (`Home` + `Edit` tabs).
- Validates and normalizes arbitrary layout JSON.
- Implements `assignCommandToSlot`, `clearSlot`, and lookup helpers.

## Data Model
- Layout: `RibbonLayout -> tabs -> groups -> items` (`src/model/types.ts`)
- Item fields include `slotId`, `icon`, `commandId`, optional `args`, optional labels/tooltips.
- Slot capacity is fixed by `SLOT_COUNT = 128`.
- Current layout schema version is `1`.

## Runtime Data Flow
1. Activation
- `activate()` instantiates services and registers commands/provider.

2. View resolution
- `RibbonViewProvider.resolveWebviewView()` sets script/style resources and CSP.
- Host sends initial `state` payload to webview.

3. Render
- Webview stores state, chooses active tab, and renders toolbar/groups/items.
- Slot width and outline appearance are driven by settings and CSS variables/data attributes.

4. Execute action
- Clicking a slot in webview posts `executeSlot`.
- Host routes to `vscodeRibbon.slotNNN`.
- `SlotCommandService` resolves slot mapping from layout.
- `ActionExecutor` executes mapped VS Code command.

5. Customize and persist
- Webview edits layout locally in customize mode.
- Webview posts `saveLayout` with updated layout JSON.
- Host validates/normalizes and persists via `RibbonConfigService.updateLayout`.
- Config change event triggers republish to webview.

## Host-Webview Message Contract
- Webview to host: `ready`, `toggleCustomizeMode`, `executeSlot`, `saveLayout`, `assignSlotFromPalette`, `assignSlotManual`, `clearSlot`, `copySnippet`, `resetLayout`
- Host to webview: `state` with `{ layout, settings, customizeMode, slotCount, missingCommandIds }`

## Theming and UI Behavior
- UI is dark-first but theme-aware via VS Code CSS vars in `media/webview.css`.
- `slotMinWidth`/`slotMaxWidth` control variable-width slot cards.
- `slotShowOutline` toggles themed borders/background cards (default off).
- Missing commands show warning border/label and disable execution button.

## Reliability and Safety
- Invalid layout input falls back to default layout.
- Command execution failures are caught, logged, and surfaced as non-blocking errors.
- Capture mode times out after 60 seconds and cleans listeners.
- Output logging uses `VS Code Ribbon` channel (`src/services/logger.ts`).

## Testing
- Current automated tests are in `src/test/suite/layoutModel.test.ts`.
- Coverage is focused on layout model behavior:
- validation/fallback
- default layout expectations
- slot assignment and clear behavior
- Manual smoke testing is required for:
- webview rendering and customize interactions
- command capture flow
- slot command execution in Extension Development Host
