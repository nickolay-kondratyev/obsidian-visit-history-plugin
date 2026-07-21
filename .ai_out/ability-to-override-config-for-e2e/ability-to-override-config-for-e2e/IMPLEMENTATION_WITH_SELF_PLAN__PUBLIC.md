# IMPLEMENTATION (self-plan) — dev config overrides for e2e — PUBLIC

## Summary
Added a `ConfigProvider` seam that resolves EFFECTIVE runtime config. A dev-only overrides
JSON file (named by env var `__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__`, set only by the
e2e harness) can override values — bypassing hard limits like the min-5 s idle floor — without
touching persisted settings. Prod behavior is byte-for-byte unchanged when the env var is unset.
Delivered an e2e spec proving a sub-floor (1 s) idle timeout closes a session well under the floor.

## Design decisions
- **`ConfigProvider` is the only seam** other code depends on. `FocusDurationTracker`'s idle
  closure now calls `configProvider.getIdleTimeoutMs()` instead of reading `settings` directly.
  It hides whether a value came from settings or an override.
- **Effective idle = override (if present, finite, > 0) `* 1000`, else `settings.idleTimeoutSeconds * 1000`**.
  The override is NOT re-clamped to the floor (the whole point). A zero/negative/NaN override
  falls back to settings so a malformed dev file can't arm an instant-fire idle timer.
  Settings path stays a LIVE read (settings-tab change still applies without reload).
- **`ConfigProviderDefault` takes a narrow structural host** (`ConfigSettingsHost = { settings: { idleTimeoutSeconds } }`),
  not the whole plugin — mirrors `HeatmapSettingsHost`. Fully unit-testable.
- **Boundary reader mirrors `DesktopOsInfo`**: `DevOverridesFileSourceDefault` is `Platform`-guarded
  (`isDesktop && isDesktopApp`), try/catch-wrapped, TYPED `require('fs')` + `process.env` access;
  returns null on mobile / unset env / any failure. Reads the file ONCE (via `DevConfigOverridesReader`
  in the `PluginFactory` ctor). `console.error` only on genuine failures where the path WAS provided
  (unreadable file; malformed JSON).
- **Overrides never touch `data.json`** — runtime read-through only.
- **Scope (Pareto)**: only `idleTimeoutSeconds` is consumed. `DevConfigOverrides` is a typed partial
  map, trivially extensible (e.g. `unfocusGraceMs`) but NO unused keys added (see CALLOUT in CLARIFICATION).

## Files added (src)
- `src/core/config/ConfigProvider.ts` — `ConfigProvider` iface + `ConfigSettingsHost` + `ConfigProviderDefault`.
- `src/core/config/DevConfigOverridesReader.ts` — `DevConfigOverrides` type + reader (parse once, empty on failure).
- `src/core/config/DevOverridesFileSource.ts` — `DevOverridesFileSource` iface + Default (env-gated desktop fs read);
  exports `DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR` (source of truth for the env var name).
- Mirrored tests: `ConfigProvider.test.ts`, `DevConfigOverridesReader.test.ts`, `DevOverridesFileSource.test.ts`.

## Files changed (src)
- `src/core/init/PluginFactory.ts` — new `configProvider` field; constructs
  `new ConfigProviderDefault(plugin, new DevConfigOverridesReader(new DevOverridesFileSourceDefault()).overrides)`
  in the ctor; idle closure now `() => this.configProvider.getIdleTimeoutMs()`.

## Files changed (e2e)
- `e2e/constants.ts` — added `DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR` (sync-pointer comment → src).
- `e2e/obsidianHarness.ts` — `LaunchOptions.devConfigOverrides?` + exported `DevConfigOverrides` type;
  writes `<run-dir>/dev-config-overrides.json` and spawns Obsidian with `env: { ...process.env, [ENV]: path }`
  (an explicit env copy, so behavior is identical when no override is supplied).
- `e2e/harnessFixture.ts` — `useHarness(idleTimeoutSeconds, devConfigOverrides?)` passthrough.
- `e2e/idleTimeoutOverride.e2e.ts` — NEW spec (S6): settings idle 180 s + override 1 s → session
  closes in <4 s (proves the sub-floor override, not the setting/floor, drives the idle path).
  Existing `idleTimeout.e2e.ts` (floor-5 case) left intact.

## Docs
- `AGENTS.md` (= `CLAUDE.md` symlink): added `core/config/` to the architecture tree + a
  "Config seam (ConfigProvider)" key design-decision bullet.
- `docs/e2e-testing.md`: new "Dev config overrides" section (mechanism, env var, harness usage).

## How the e2e override works (end to end)
1. Test calls `useHarness(180, { idleTimeoutSeconds: 1 })`.
2. Harness writes `{ "idleTimeoutSeconds": 1 }` to `<run-dir>/dev-config-overrides.json` and sets
   `__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__` on the spawned Obsidian process env.
3. Plugin `PluginFactory` ctor → `DevOverridesFileSourceDefault` reads that path once (desktop-guarded).
4. `ConfigProviderDefault.getIdleTimeoutMs()` returns `1 * 1000` (override wins, no floor re-clamp).
5. `FocusDurationTracker` closes the idle session at ~1 s; the spec asserts on the on-disk `.vh_v3`.

## Test / build / lint results
- `npm test` → **404 passed (42 files)**, exit 0. (18 new tests across the 3 config test files.)
- `npm run build` → exit 0.
- `npm run lint` → **0 errors, 1 warning** (pre-existing `ConfirmModal setWarning` deprecation — not mine).
- `npx tsc -p e2e/tsconfig.json` (e2e spec typecheck) → exit 0.

## Reviewer scrutiny points
- **Real e2e NOT run here** (downloads/launches real Obsidian; not reliable in this env). The e2e
  specs TYPECHECK clean, but `npm run test:e2e` (incl. `idleTimeoutOverride.e2e.ts`) must be verified
  by human/CI. Timing thresholds (poll 10 s, assert elapsed <4 s) may need a nudge on slow CI.
- **`DevOverridesFileSource.test.ts`** deliberately does not unit-test the happy file-read (would
  require importing node builtins → blocked by `obsidianmd/no-nodejs-modules`, which
  `eslint-comments/no-restricted-disable` forbids disabling). It covers mobile→null, unset→null,
  and unreadable-path→null(+log); the successful read is proven by the real e2e test — same
  precedent as `DesktopOsInfo.test.ts` leaving its `os` read to the real environment.
- **`process`/`require('fs')` lint**: handled with the same per-line `no-undef` / `no-require-imports`
  disables `DesktopOsInfo` uses (static `import 'node:*'` is what the obsidianmd rule forbids; `require` is fine).

## #QUESTION_FOR_HUMAN
None — ticket was self-consistent; no hacks required.

## Not done (owned elsewhere / out of scope)
- Changelog entry (TOP_LEVEL_AGENT owns it). Ticket left open. No commit made.

---

## Iteration 1 — resolve [minor DRY] reviewer finding

**Finding addressed:** the desktop-guard (`Platform.isDesktop && isDesktopApp`) + typed
`require(name)` + try/catch + null-fallback + eslint-disable + WHY-comment pattern was
near-duplicated between `DevOverridesFileSource` and `DesktopOsInfo`. Extracted into ONE
shared helper so the knowledge (and its eslint-disable justification) lives in a single place.

**What changed**
- **NEW `src/core/util/env/DesktopNodeModule.ts`** — static `DesktopNodeModule.require<T>(moduleName): T | null`.
  Owns the sole copy of: the `Platform` guard (both flags), the typed `require(name) as T` at the
  system boundary, the try/catch → null, and the single
  `@typescript-eslint/no-require-imports, no-undef` eslint-disable + the WHY comment (why require /
  why mobile-safe). Returns null on mobile / require-throw; never throws.
- **NEW `src/core/util/env/DesktopNodeModule.test.ts`** — mirrors `DesktopOsInfo.test.ts`'s Platform
  boundary handling (mutable-singleton flip + `afterEach` restore; no over-mocking of `require`).
  Covers: not-desktop → null, desktop-sized-but-not-Electron → null, module available → returns it
  (real `os` under vitest), require throws on unknown module → null (exercises the try/catch).
- **`DesktopOsInfo.ts`** — `read<T>` now calls `DesktopNodeModule.require<DesktopOsModule>('os')`;
  keeps its own try/catch around the READER call only (a member call could still throw). Behavior
  identical: null on mobile / any failure. Existing `DesktopOsInfo.test.ts` unchanged, still green.
- **`DevOverridesFileSource.ts`** — `readRawJson()` now reaches `fs` via
  `DesktopNodeModule.require<DesktopFsModule>('fs')`; dropped its own duplicated Platform guard and
  `Platform` import. `process.env` access stays local (a distinct Node-global concern, not the
  require pattern; still guarded by its own try/catch + `no-undef` disable). Observable behavior
  identical for every existing test (mobile→null, unset→null, unreadable→null+log): on mobile the
  `process.env` read yields the path but the `fs` require returns null → readRawJson null. Existing
  `DevOverridesFileSource.test.ts` unchanged, still green.
- **`AGENTS.md`** — `core/util/env/` line now names `DesktopNodeModule` (shared Platform-guarded
  typed require, used by `DesktopOsInfo` + `DevOverridesFileSource`). Minimal, one clause.

**Behavior guarantee:** pure boundary refactor. No change to `ConfigProvider` precedence, the e2e
specs, or any resolution logic. Both consumers still return null/empty on mobile/failure and never throw.

**Verify (all green, redirected to `.tmp/`)**
- `npm test` → **408 passed (43 files)**, exit 0 (+4 new `DesktopNodeModule` tests; was 404/42).
- `npm run lint` → **0 errors, 1 warning** (same pre-existing `ConfirmModal setWarning` deprecation).
- `npm run build` → exit 0.
- `npx tsc -p e2e/tsconfig.json --noEmit` → exit 0.

**DRY finding: RESOLVED.** The "how to safely require a desktop-only Node builtin" knowledge and its
lone eslint-disable now live only in `DesktopNodeModule`; both call sites consume it.
