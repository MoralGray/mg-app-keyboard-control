# AGENTS.md — mg-app-keyboard-control

## What this is

Browser library that layers keyboard-driven hint labels over interactive elements (buttons, inputs, links, etc.). Press a shortcut to show hints, type letters to focus/click. Output is a self-contained IIFE bundle (`dist/keyboard-control.js`).

Single entrypoint: `src/index.ts` — exports `KeyboardControlEngine` + types + helpers.

## Commands

| Command | What |
|---|---|
| `npm run build` | Vite lib build → IIFE, no minify, out to `dist/keyboard-control.js` |
| `npm run typecheck` | `tsc --noEmit` (strict, noUnusedLocals, noUnusedParameters on) |
| `npx biome check --write src/` | Lint + format in one pass (4-space indent, single quotes, semicolons always) |

There is no test framework, no test runner, no tests.

## Conventions

- All source lives in `src/index.ts` — single file, no barrel exports or submodules.
- Biome config uses `includes: ["**", "!!**/dist"]` — always exclude `dist/` from lint/format.
- `TODO.md` is gitignored — local scratch notes, not authoritative.
- Prefer `npx biome check --write` over separate lint/format calls since no npm script wraps it.

## Build output

`vite build` produces `dist/keyboard-control.js` — IIFE registering `window.KeyboardControl`. No code splitting, no hashing.

## Environment

Node 23 via mise (`.mise.toml`). `NODE_ENV=development` and `LOG_ENV=ON` set by mise.