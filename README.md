# VS Code Ribbon

Tabbed ribbon extension for VS Code with bindable slots (`vscodeRibbon.slot001` to `vscodeRibbon.slot128`).

## Features

- Panel-hosted ribbon (`WebviewView`) with tabs, groups, and icon items
- Panel-position-aware tab placement:
  - panel `top`: tabs above ribbon slots
  - panel `bottom`: tabs below ribbon slots
  - panel `left`/`right`: vertical tabs on the outside edge
- Starter tabs:
  - `Home` with common workspace commands
  - `Edit` with undo/redo/cut/copy/paste/find/replace/comment actions
- Customize mode:
  - create/rename/delete/move tabs
  - create/rename/delete/move groups
  - create/edit/delete/move items
- Slot-based command dispatch:
  - click icon executes slot mapping
  - keyboard shortcuts can target slot commands
- Assignment flows:
  - assign slot from command palette capture
  - assign slot manually by command ID
  - clear slot
- Layout import/export JSON
- User/workspace write-target selection
- Activity Bar `Ribbon` control surface to enable/disable the ribbon

## Settings

- `vscodeRibbon.layout`
- `vscodeRibbon.enabled`
- `vscodeRibbon.writeTarget` (`user` | `workspace`)
- `vscodeRibbon.showLabels`
- `vscodeRibbon.iconSize` (`small` | `medium` | `large`)
- `vscodeRibbon.compactMode`
- `vscodeRibbon.slotMinWidth` (number, px)
- `vscodeRibbon.slotMaxWidth` (number, px)
- `vscodeRibbon.slotShowOutline` (boolean)
- `vscodeRibbon.autoAcceptCommandPaletteSelection`
- `vscodeRibbon.capturePaletteWrapperCommands`

## Keybinding example

Bind a key to slot 42 in `keybindings.json`:

```json
{
  "key": "ctrl+alt+4",
  "command": "vscodeRibbon.slot042",
  "when": "editorTextFocus"
}
```

Use command `VS Code Ribbon: Copy Slot Keybinding Snippet` to copy a starter snippet to clipboard.

## Development

```bash
npm install
npm run compile
npm test
```

Run the extension from VS Code debug host.

## Note on palette capture

Command capture from Command Palette depends on runtime support for command execution events. If unavailable in your VS Code build, use manual slot assignment.

## Icon sources

- `Edit` tab default icons use Font Awesome SVG assets hosted on jsDelivr:
  `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/solid/*`
