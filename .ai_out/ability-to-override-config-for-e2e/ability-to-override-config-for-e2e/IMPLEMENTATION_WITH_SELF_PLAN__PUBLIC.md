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
