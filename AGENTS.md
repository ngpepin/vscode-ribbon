# VS Code Ribbon Agent Guide

## Purpose
This file is the operating guide for contributors and coding agents working in this repository.

The project is a VS Code extension that provides a tabbed ribbon UI (`WebviewView`) with bindable slots (`vscodeRibbon.slot001` to `vscodeRibbon.slot128`), layout customization, and user/workspace config persistence.

## Project Layout
- `src/extension.ts`: activation entry point, service wiring, command registration.
- `src/constants.ts`: extension namespace, command IDs, slot command ID formatter.
- `src/model/types.ts`: layout and settings types.
- `src/model/layoutModel.ts`: default layout, validation, normalization, slot assignment helpers.
- `src/services/ribbonConfigService.ts`: settings/layout read-write and write-target resolution.
- `src/services/ribbonViewProvider.ts`: webview lifecycle, host-webview message bridge, state publish.
- `src/services/actionExecutor.ts`: command availability cache + execution path.
- `src/services/commandCaptureService.ts`: command palette capture flow.
- `src/services/slotCommandService.ts`: runtime registration of 128 slot commands.
- `media/webview.js`: ribbon UI rendering, customize mode actions, message send/receive.
- `media/webview.css`: theme-aware ribbon styling, dark-first visual defaults.
- `package.json`: contributed commands, settings schema, view container/view contributions.
- `README.md`: end-user usage and configuration notes.

## Local Workflow
1. Install dependencies: `npm install`
2. Build TypeScript: `npm run compile`
3. Run tests: `npm test`
4. Run extension in VS Code: use debug launch (`F5`) and open the `Ribbon` panel.

## Guardrails
- Treat `src/` and `media/` as source of truth. `dist/` is generated output.
- Keep the slot command contract stable.
- Static contributed commands remain `vscodeRibbon.slot001` ... `vscodeRibbon.slot128`.
- Runtime registration in `SlotCommandService` must match `SLOT_COUNT`.
- Keep layout schema versioned (`version: 1`) and validated before write.
- If a setting is added/changed, update all of:
- `package.json` configuration schema
- `src/model/types.ts` (`RibbonSettings`)
- `src/services/ribbonConfigService.ts` (`getSettings`)
- `README.md` settings list
- If webview message types change, update both ends:
- sender/handlers in `media/webview.js`
- `handleMessage` and state publish logic in `src/services/ribbonViewProvider.ts`
- Keep CSP strict in `RibbonViewProvider.getHtml()`; do not loosen without clear reason.
- Preserve graceful failure behavior.
- Missing command IDs render disabled slots in the webview.
- Execution failures are non-fatal and surfaced via notification + output channel logs.

## Common Change Map
1. Add a host command:
- Register handler in `src/extension.ts`.
- Contribute command in `package.json`.
- Add UI trigger in `media/webview.js` if needed.
2. Add a ribbon setting:
- Update the four files listed in Guardrails.
- Render setting impact in `media/webview.js` and/or `media/webview.css`.
3. Change default ribbon content:
- Edit `createDefaultLayout()` in `src/model/layoutModel.ts`.
- Update tests in `src/test/suite/layoutModel.test.ts`.

## Validation Checklist
- `npm run compile` succeeds.
- `npm test` passes.
- Manual smoke check in Extension Development Host:
- Ribbon loads in panel view.
- Clicking an assigned slot executes its command.
- Unassigned slot command shows the no-op informational message.
- Settings changes (for example slot width/outline) immediately affect rendering.
