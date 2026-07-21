# EXPLORATION — dev config overrides for e2e

## Goal
Add ability to override plugin config (incl. hard-limited internals) during e2e via env var
`__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__` → JSON file. Well-abstracted `ConfigProvider`
interface hides the mechanism. End result: e2e idle-timeout test without waiting the enforced floor.

## Config/settings flow (key files)
- `src/settings.ts`
  - `DEFAULT_IDLE_TIMEOUT_SECONDS = 180` (:8), `MIN_IDLE_TIMEOUT_SECONDS = 5` (:14)
  - `IdleTimeoutSeconds.isValid` (:21-26) — the hard floor (`>= 5`, integer)
  - `VisitHistoryPluginSettings { idleTimeoutSeconds; heatmap }` (:31-34)
  - `SettingsSanitizer.sanitize` (:43-57) — loadData() boundary; `sanitizeIdleTimeoutSeconds`
    REJECTS invalid/sub-floor back to DEFAULT (180). This clamp is why e2e cannot go below 5 today.
- `src/main.ts`
  - `loadSettings()` (:163-166) calls `SettingsSanitizer.sanitize(await this.loadData())` in `onload` (:25) before PluginFactory.
  - `settings` is a plain public field; consumers read `plugin.settings.xxx` directly (no provider today).

## Where idleTimeout is READ at runtime (the seam)
- `FocusDurationTracker` (`src/core/focusDuration/FocusDurationTracker.ts`)
  - Takes injected `IdleTimeoutMsProvider = () => number` (:11), ctor `getIdleTimeoutMs` (:114-119).
  - Called live at idle decisions (:205, :245, :282, :306). Never touches settings directly.
- **Injection site**: `src/core/init/PluginFactory.ts:132-137`, inside `activateUserScopedRecording`:
  `() => this.plugin.settings.idleTimeoutSeconds * 1000`  ← THE seam to route through ConfigProvider.
- Also: `UNFOCUS_GRACE_MS = 10_000` hardcoded in `FocusDurationTracker.ts:21` — a non-setting constant;
  an example of "hard-limited, not exposed" config the override could reach (motivating ticket:
  `_tickets/e2e-grace-timer-expiry-spec.md`).

## Existing conventions to mirror
- Provider pattern: `XxxProvider` interface + `XxxProviderDefault` impl, wired in PluginFactory ctor,
  constructor-injected (LastVisitProvider, DeviceNameProvider, IsTrackedProvider, UserNameProvider).
- Store pattern: `HeatmapConfigStore` interface + `PluginHeatmapConfigStore` taking a narrow structural
  host (`HeatmapSettingsHost`) not the whole plugin — closest precedent for a settings-facing abstraction.
- Desktop-only Node access: `src/core/util/env/DesktopOsInfo.ts` — `Platform.isDesktop && Platform.isDesktopApp`
  guard + try/catch + typed `require(...)` + null fallback. **Template for reading `process.env` + fs JSON**
  (mobile-safe; `manifest.json` isDesktopOnly:false). No `process.env` usage anywhere in `src/` today (greenfield).

## e2e infrastructure
- `e2e/` drives real headless Obsidian (Electron) over CDP; asserts on-disk `.vh_v3`. Run: `npm run test:e2e`
  → `scripts/run-e2e.sh` (pinned Obsidian 1.12.7, seeds `.dev-vault`, typecheck specs, Playwright workers:1).
- `e2e/obsidianHarness.ts` `ObsidianHarness.launch` (:41-127):
  - copies `.dev-vault` fresh, spawns Obsidian (`spawn(..., { detached:true })`, inherits parent `process.env`
    by default — no explicit `env:` map today).
  - **writes `data.json` = `{ idleTimeoutSeconds }`** (:56-61) BEFORE enabling plugin — the ONLY config
    injection today; still passes through SettingsSanitizer so clamped to floor 5.
  - pins identity localStorage (`obsidian-vh-user-name=e2e_user`, `obsidian-device-name=e2e_device`) then enables plugin.
- Specs: `canvasFocus`, `closeUnloadFlush`, `focusSwitch`, `idleTimeout`, `switchToSettings`.
  - `e2e/idleTimeout.e2e.ts` uses `IDLE_SECONDS = 5` (the floor), polls up to 12s. This is the test to improve.
- `e2e/harnessFixture.ts` `useHarness(idleTimeoutSeconds)`; `HIGH_IDLE_SECONDS=180`.
- `e2e/constants.ts` duplicates runtime constants (obsidian types-only). `e2e/vhAssert.ts` builds path + bounded-polls.
- Existing e2e env vars: `OBSIDIAN_PATH`, `OBSIDIAN_CACHE_DIR`, `OBSIDIAN_E2E_EXTRA_ARGS` (launch-only).

## Design implications
- New `ConfigProvider` sits between "sanitized/hardcoded defaults" and "effective runtime value".
- A `DevOverridesReader` reads env var → JSON file ONCE (guarded Node/desktop-only, try/catch, empty on failure).
- Effective idle timeout = override (if present, NOT re-clamped to floor) else sanitized setting.
- Route `FocusDurationTracker`'s idle closure through ConfigProvider (single seam).
- Harness must ensure the env var is set on the spawned Obsidian process (currently inherits parent env).
