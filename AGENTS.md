# AGENTS.md — mg-app-keyboard-control

## What this is

Browser library that layers keyboard-driven hint labels over interactive elements (buttons, inputs, links, etc.). Press a shortcut to show hints, type letters to focus/click. Output is a self-contained IIFE bundle (`dist/keyboard-control.js`).

Single entrypoint: `src/index.ts` — exports `KeyboardControlEngine` + types + helpers.

## Commands

| Command | What |
|---|---|
| `npm run prerelease` | Lint + format + typecheck before releasing |
| `npm run release` | Build + wrap into all variants (auto-runs `prerelease` first) |
| `npm run typecheck` | `tsc --noEmit` (strict, noUnusedLocals, noUnusedParameters on) |
| `npx @biomejs/biome check --write src/` | Lint + format in one pass (4-space indent, single quotes, semicolons always) |

There is no test framework, no test runner, no tests.

## Conventions

- All source lives in `src/index.ts` — single file, no barrel exports or submodules.
- Biome config uses `includes: ["**", "!!**/dist"]` — always exclude `dist/` from lint/format.
- `TODO.md` is gitignored — local scratch notes, not authoritative.
- Prefer `npx @biomejs/biome check --write` over separate lint/format calls since no npm script wraps it.

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
