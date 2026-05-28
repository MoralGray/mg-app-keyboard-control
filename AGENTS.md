# AGENTS.md — mg-app-keyboard-control

## What this is

Browser library that layers keyboard-driven hint labels over interactive elements (buttons, inputs, links, etc.). Press a shortcut to show hints, type letters to focus/click. Output is a self-contained IIFE bundle (`dist/keyboard-control.js`).

Single entrypoint: `src/index.ts` — exports `KeyboardControlEngine` + types + helpers.

## Commands

| Command | What |
|---|---|
| `npm run prerelease` | Lint + format + typecheck before releasing |
| `npm run release` | Build + wrap into all variants (auto-runs `prerelease` first) |
| `npx tsc --noEmit` | Typecheck (strict, noUnusedLocals, noUnusedParameters on) |
| `npx @biomejs/biome check --write src/` | Lint + format in one pass (4-space indent, single quotes, semicolons always) |

There is no test framework, no test runner, no tests.

## Conventions

- All source lives in `src/index.ts` — single file, no barrel exports or submodules.
- Biome config uses `includes: ["**", "!!**/dist"]` — always exclude `dist/` from lint/format.
- `TODO.md` is gitignored — local scratch notes, not authoritative.
- Prefer `npx @biomejs/biome check --write` over separate lint/format calls since no npm script wraps it.

## Architecture & Exports

### Types

- **`KeyboardControlConfig`** — user-facing config: `shortcut` (key + modifiers) + optional `selector`.
- **`HintedElement`** — scanned element: `element`, `hint` string, `rect` (DOMRect), `offsetX/Y` (collision resolution), optional `url` (for text links).
- **`KeyboardControlState`** — snapshot: `isActive`, `hintedElements`, `currentFilter`, `isTwoLetterMode`.
- **`EngineConfig`** / **`EngineState`** — internal engine types (same shape).
- **`Listener`** — callback for state changes.

### Hint Generation (`generateHints`)

- Count <= 26: one-letter hints (`a`–`z`).
- Count > 26: two-letter combos (`aa`, `ab`, ..., `zz`). Max 676.

### Element Scanning (`scanInteractiveElements`)

Scans DOM using a default selector (buttons, inputs, selects, textareas, links, role elements, contenteditable, tabindex). Then **`scanTextLinks`** adds text-node URLs via TreeWalker + `document.createRange`. Hints are assigned, biggest-input hint overrides applied, then collision resolution runs.

**Default selector** includes: `button`, `input`, `select`, `textarea`, `a[href]`, `[role="button"]`, `[role="switch"]`, `[contenteditable]`, `[tabindex]:not([tabindex="-1"])`.

### Text Link Detection (`scanTextLinks`)

Walks all text nodes in `document.body`. Skips nodes inside `<a>` tags. Matches `https?://\S+` via regex, creates a Range for each match, and pushes a `HintedElement` with `url` set and `element` pointing to the parent node. These appear as normal hint targets with the `url` property.

### Collision Resolution (`resolveCollisions`)

Tries 9 positions (0,0 / +1,0 / 0,+1 / +1,+1 / 0,-1 / +1,-1 / -1,0 / -1,+1 / -1,-1) to avoid hint-label overlap. Falls back to original position if all collide.

### `focusElement` — Activating a Hinted Element

Called when a hint is typed to completion. Behavior:

1. **Focus + scroll** — calls `element.focus()` + `scrollIntoView`.
2. **Outline (string-links only)** — if `item.url` exists, adds `2px solid #4A90D9` outline + 2px offset on the parent element. Cleared on cleanup.
3. **Key handler** — `Enter` or `Space` opens URL (`window.open`) or calls `element.click()`.
4. **Cleanup** — removes all listeners on:
   - `Enter`/`Space` action
   - `Tab` or `Escape` keypress
   - `mousedown` anywhere
   - `blur` on the focused element
5. **Global singleton** — `_activeFocusCleanup` ensures only one focused element has active listeners at a time. Calling `focusElement` twice automatically cleans up the first.

### Input Favouring (`applyBiggestInputHint`)

Largest `<input>` gets hint `i` (single-letter mode) or `i1`–`i0` (two-letter mode). Existing hints are swapped to avoid collisions.

### `updateRects`

Recalculates bounding rects and re-runs collision resolution. Used on scroll/resize.

### `matchShortcut`

Checks a KeyboardEvent against a key + modifier spec (alt/ctrl/shift/meta). Case-insensitive key comparison.

## Engine: `KeyboardControlEngine`

### Lifecycle

- **`constructor(config?)`** — defaults to `Ctrl+\` shortcut.
- **`mount()`** — registers keydown listener on document (capture phase). Detects activation shortcut, typing, Escape, and Ctrl+Shift+\ for settings.
- **`unmount()`** — removes keydown listener, closes settings, deactivates, clears subscribers.

### Activation Flow

1. `activate()` scans elements, creates overlay, notifies subscribers.
2. `deactivate()` removes overlay, clears state, notifies.
3. During active mode: each keystroke filters hints. On exact match → `focusElement` + deactivate. On partial match → update filter + re-render overlay (dims non-matching hints to 0.15 opacity). On no match → deactivate.

### Overlay (`renderOverlay` / `removeOverlay`)

Fixed-position div (z-index 2147483646), pointer-events none. Each hint is a fixed-position label (z-index 2147483647) styled as a dark badge with monospace text. In two-letter mode with an active filter, only the unfiltered suffix is shown. Scroll/resize listeners re-render on change.

### Settings Modal (`openSettings` / `closeSettings`)

Opened via Ctrl+Shift+\. Lets the user remap the activation shortcut. A `keydown` capture handler listens on the modal; Save persists the new combo, Cancel/Escape closes. State returned to normal on close.

### Subscriptions

`subscribe(fn)` returns an unsubscribe function. The engine calls all listeners after activation, deactivation, and filter changes.

### Exported Helpers

| Export | Purpose |
|---|---|
| `DEFAULT_SELECTOR` | Default CSS selector for interactive elements |
| `ALPHABET` | `'abcdefghijklmnopqrstuvwxyz'` |
| `HINT_W` / `HINT_H` | Hint label dimensions (30x22) |
| `generateHints` | Generate hint strings for N elements |
| `scanInteractiveElements` | Full DOM scan + hint assignment |
| `scanTextLinks` | Text-node URL discovery |
| `isElementVisible` | Bounding rect check |
| `resolveCollisions` | Hint label position de-duplication |
| `updateRects` | Recalculate all rects on scroll/resize |
| `matchShortcut` | KeyboardEvent shortcut matching |
| `focusElement` | Focus + Enter handler + cleanup |

## Build output

`vite build` produces `dist/keyboard-control.js` — IIFE registering `window.KeyboardControl`. No code splitting, no hashing.

`npm run release` runs `bun scripts/build-all.ts` which:
1. runs `vite build` to produce the raw IIFE
2. wraps it with headers/footers per target into `dist/`:

| File | Target | Wrapper |
|---|---|---|
| `keyboard-control.js` | Generic | none (raw IIFE) |
| `violetmonkey.user.js` | Violetmonkey | userscript header + auto-mount |
| `tampermonkey.user.js` | Tampermonkey | userscript header + auto-mount |
| `obsidian.script.js` | Obsidian | none (plain script, no header) |

To add a new target, edit the `WRAPPERS` map in `scripts/build-all.ts`.

## Environment

Node 23 via mise (`.mise.toml`). Bun 1.3 also available (used for `release`). `NODE_ENV=development` and `LOG_ENV=ON` set by mise.