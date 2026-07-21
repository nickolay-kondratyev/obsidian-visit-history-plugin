# IMPLEMENTATION (self-plan) — dev config overrides for e2e — PRIVATE MEMORY

## Goal
Add `ConfigProvider` seam so e2e can override idle timeout below the hard 5s floor via env var
`__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__` → JSON file. Prod unchanged when env unset.

## Design (locked)
New dir `src/core/config/`:
- `DevOverridesFileSource.ts` — interface `DevOverridesFileSource { readRawJson(): string | null }`
  + `DevOverridesFileSourceDefault` (boundary: Platform-guarded desktop-only `process.env[ENV]` + `require('fs').readFileSync`, mirror DesktopOsInfo; console.error on read failure when path WAS set; null on mobile/unset/failure). Exports `DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR`.
- `DevConfigOverridesReader.ts` — owns `interface DevConfigOverrides { readonly idleTimeoutSeconds?: number }`;
  class reads source ONCE in ctor → `readonly overrides: DevConfigOverrides`; static parse: null→{}, malformed JSON→{} (console.error since path provided), extract idleTimeoutSeconds if number.
- `ConfigProvider.ts` — interface `ConfigProvider { getIdleTimeoutMs(): number }` + `ConfigSettingsHost { readonly settings: { readonly idleTimeoutSeconds: number } }` + `ConfigProviderDefault(host, overrides)`.
  getIdleTimeoutMs: override present & finite & >0 → override*1000 (NO floor re-clamp); else host.settings.idleTimeoutSeconds*1000 (live-read).

## Wiring
- PluginFactory ctor: `const devOverrides = new DevConfigOverridesReader(new DevOverridesFileSourceDefault()).overrides;`
  `this.configProvider = new ConfigProviderDefault(plugin, devOverrides);` (field `readonly configProvider: ConfigProvider`).
- Replace line ~135 closure `() => this.plugin.settings.idleTimeoutSeconds * 1000` → `() => this.configProvider.getIdleTimeoutMs()`.

## e2e
- `e2e/constants.ts`: add DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR (sync comment → src source of truth).
- `e2e/obsidianHarness.ts`: LaunchOptions.devConfigOverrides?: { idleTimeoutSeconds?: number }; write runDir/dev-config-overrides.json; spawn with `env: { ...process.env, [ENV]: path }` (keeps inherit behavior when absent).
- `e2e/harnessFixture.ts`: useHarness(idleTimeoutSeconds, devConfigOverrides?).
- New spec `e2e/idleTimeoutOverride.e2e.ts`: settings idle 180 + override 1s → session closes <4s (proves sub-floor). Keep existing idleTimeout.e2e.ts intact.

## Tests (vitest, mirrored)
- ConfigProvider.test.ts: override→ms (incl 1s→1000 sub-floor), absent→settings, zero/neg/NaN→settings, live-read.
- DevConfigOverridesReader.test.ts: fake source null→{}, malformed→{}, valid→parsed, non-number idle→{}.
- DevOverridesFileSource.test.ts: mobile→null (Platform flip); env unset→null; env→nonexistent→null; env→real temp file→content.

## Docs
- CLAUDE.md: Architecture core/config/ line + Key design decision on ConfigProvider/dev override seam.
- docs/e2e-testing.md: override file mechanism + env var.

## Verify
npm test / npm run build / npm run lint (ZERO) ; e2e typecheck `npx tsc -p e2e/tsconfig.json`. Real e2e run = human/CI.

## Status: DONE
- All files created/wired as planned. npm test 404 pass (42 files), build exit 0, lint 0 errors
  (1 pre-existing ConfirmModal warning), e2e tsc exit 0.
- GOTCHA: `obsidianmd/no-nodejs-modules` cannot be eslint-disabled (`no-restricted-disable`),
  so the boundary test uses `vi.stubEnv` + no node imports; happy file-read proven by e2e only.
- CLAUDE.md is a symlink → edit AGENTS.md (real target).
- Real e2e (`npm run test:e2e`) NOT run (env can't reliably launch Obsidian) — human/CI must verify.
- No commit, ticket left open (TOP_LEVEL owns changelog + git).
