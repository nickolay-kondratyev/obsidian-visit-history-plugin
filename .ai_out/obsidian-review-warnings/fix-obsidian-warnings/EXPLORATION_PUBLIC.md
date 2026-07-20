# EXPLORATION — fix-obsidian-warnings

## Headline
`npm run lint` at HEAD reports **0 errors, 2 pre-existing warnings** (`prefer-active-doc`
main.ts:133,137 — already ticketed, out of scope). **None of categories A–E reproduce
locally.** Every category-A site traces to a concrete TS type — no `any` anywhere.

Working theory for the bot's A warnings: the review bot's checkout likely lacks the
`submodules/obsidian-id-lib` git submodule (a `file:` dep pointing at a submodule). Without
`--recurse-submodules`, `obsidian-id-lib` types fail to resolve → the bot falls back to
implicit `any`, cascading `no-unsafe-*` across every `docIdService.*`/`file.*` call. This is a
**CI/packaging concern, not a source-code defect.** The shipped `main.js` bundles the lib source
via esbuild, so runtime is unaffected.

## Summary table

| Site | Cat | Root cause | Minimal fix | Risk | Recommend |
|---|---|---|---|---|---|
| DocIdFocusListener.ts:22, VhV3FocusDurationListener.ts:28, PluginFactory.ts:80, DocIdBackfillService.ts:53/69, UserNameProvider.ts:32, VisitHistoryServiceV3.ts:23/28/33/36/42, DeviceNameProvider.ts:37, fileFactory.ts:19-23 | A | Fully typed locally; bot sees `any` (missing submodule) | No code change; fix bot CI submodule checkout | LOW (no-op) | **DEFER** — verify env, not code |
| UserNameProvider.ts:32 | B | `require('os').userInfo().username` — no Platform guard | `if (!Platform.isDesktopApp) return null;` before require; keep try/catch | LOW | **FIX NOW** |
| DeviceNameProvider.ts:37 | B | `require("os").hostname()` — no Platform guard | same Platform guard | LOW | **FIX NOW** |
| VisitHistorySettingTab.ts:12 | C | No `getSettingDefinitions()` (declarative API, Obsidian 1.13.0+) | Full declarative rewrite; minAppVersion is 1.5.7 | HIGH scope / LOW value | **DEFER** (ticket) |
| ConfirmModal.ts:28 | D | `.setWarning()` deprecated 1.13.0 → `.setDestructive()` | `setDestructive()` doesn't exist <1.13.0; minAppVersion 1.5.7 → runtime TypeError for older users | MEDIUM (compat) | **DEFER** (ticket) |
| styles.css:280 | E | `scrollbar-width:none` partial in Obsidian ≤1.4.5 | add `::-webkit-scrollbar{display:none}` fallback (additive) | LOW | **FIX NOW** |
| styles.css:886 | E | `!important` on `.tt-null` (redundant — later + equal specificity vs `.tt-val`) | remove `!important` | LOW | **FIX NOW** |

## B — detail
Both sites already have try/catch + described eslint-disable (from prior flow). The B warning is
Obsidian's **own** mobile-compat AST scan (not eslint) — only silenced by a real `Platform`
guard. `Platform` is exported from `'obsidian'` (obsidian.d.ts:4677), currently unused in `src/`.
Add `import { Platform } from 'obsidian'` + `if (!Platform.isDesktopApp) return null;` immediately
before each `require('os')`. Behavior-preserving (mobile already returned null via catch).
Exact calls: `getOsUserName()` → `require('os').userInfo().username`;
`desktopHostname()` → `require("os").hostname()`.

## C — DEFER
Declarative settings API added Obsidian 1.13.0; local `obsidian` devDep is 1.12.3 (API absent).
Obsidian docs explicitly sanction `display()` as the fallback for plugins supporting <1.13.0.
minAppVersion=1.5.7. A faithful port (async backfill onClick, idle-timeout validation, confirm
modal) is a feature-parity rewrite, not a lint fix, and would force minAppVersion bump. Defer.

## D — DEFER (NOT a safe drop-in)
`setDestructive()` is `@since 1.13.0` and does NOT exist before it. minAppVersion=1.5.7 →
naive swap = `TypeError: btn.setDestructive is not a function` for users on Obsidian <1.13.0,
breaking the backfill confirm dialog. Also local devDep 1.12.3 lacks the method → `tsc` would
fail. Only "safe" fix is runtime feature-detection (a cast + branch) = MEDIUM risk/effort. The
deprecation is a compile-time nag with documented reason. Defer until minAppVersion is raised.

## E — detail
- styles.css:280 — `.vault-heatmap-view .filter-chips { scrollbar-width: none }`. Add sibling
  `.vault-heatmap-view .filter-chips::-webkit-scrollbar { display: none }`. Purely additive.
- styles.css:886 — `.vault-heatmap-view .tt-null { color: var(--vt-text-dim) !important; ... }`.
  `.tt-null` (line 885) and `.tt-val` (line 840) both specificity (0,2,0); `.tt-null` declared
  later and elements carry both classes (Tooltip.tsx:22) → cascade order already wins.
  `!important` provably redundant; remove it. Sanity-check tooltip visually.

## Other checks
- eslint.config.mts extends typescript-eslint recommendedTypeChecked (no-unsafe-* = ERROR
  locally) — if A were real, local lint would hard-fail. It doesn't. CSS is NOT eslint-linted
  (no stylelint) — E warnings come from the bot's release-checklist tooling.
- `os` builtins are esbuild `external` → stay as real `require()` in bundle (desktop-only).
- manifest.json: minAppVersion 1.5.7, isDesktopOnly false (load-bearing for C/D).

## Net scope
**FIX NOW (low-risk):** B (2 TS files, add Platform guard) + E (2 CSS edits).
**DEFER (ticket + human callout):** A (bot CI submodule), C (declarative settings), D (setWarning).
