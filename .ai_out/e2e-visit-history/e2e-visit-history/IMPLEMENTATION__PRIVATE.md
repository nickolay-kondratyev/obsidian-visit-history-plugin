# IMPLEMENTATION__PRIVATE — rehydration memory

## Status: COMPLETE (+ Iteration 1 minor polish applied). 5 e2e green ×2, vitest 386 green,
## lint 0 errors. Nothing committed.

## Iteration 1 gotchas (run-dir cleanup — the tricky one)
- SIGKILL on the Electron MAIN pid does NOT reap Chromium helper procs; they keep `userdata/`
  open → `rmSync` fails ENOTEMPTY, leaves full dirs. `maxRetries` alone still throws (helpers
  outlive the 1 s retry window) and a bare throw FAILED an e2e test.
- FIX that works: spawn `detached:true` + `process.kill(-pid,'SIGKILL')` (process GROUP),
  then `waitForChildExit(3000)`, then best-effort `rmSync` in try/catch. Group kill reaps the
  whole tree → dir frees immediately → cleanup reliable (only `.tmp/e2e/output` left).
- Cleanup is GUARDED to paths under `E2E_RUN_ROOT + sep` so a caller/binary-cache path is
  never removed. Keep it strictly best-effort (try/catch) — disk hygiene must never fail a test.
- DRY: `e2e/harnessFixture.ts` `useHarness(idleSeconds)` owns beforeEach/afterEach; specs do
  `const getHarness = useHarness(...)` in describe + `const h = getHarness()` in the test.
- `e2e/` is eslint-globalignored — new e2e files are NOT linted; verify with
  `npx tsc -p e2e/tsconfig.json`.

## Environment quirks
- Debian-ish x86_64, Node v20.20.2, non-root uid 1000, NO sudo, headless (no DISPLAY).
- **Bash noise:** every Bash call re-sources a login profile that dumps ~15 lines of
  `[2m…vintrin-env…` to stderr BEFORE the command runs. Real output is at the tail.
  Redirect verbose output to `.tmp/*.log` and `tail`/`grep -v` it.
- CLAUDE.md is a symlink → AGENTS.md. Edit AGENTS.md (Write refuses symlinks).
- node_modules + main.js were already present; submodule already initialized.

## The download/launch that works (verified)
```
OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"   # → .tmp/obsidian/1.12.7/obsidian-1.12.7/obsidian
OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"
obsidian --no-sandbox --user-data-dir=<tmp> --remote-debugging-port=0 <extraArgs>
# parse `DevTools listening on (ws://\S+)` from STDERR → chromium.connectOverCDP(ws)
# first page: browser.contexts()[0].pages()[0] (poll up to 30s)
# waitForFunction window.app?.workspace?.layoutReady === true
# set localStorage obsidian-vh-user-name / obsidian-device-name BEFORE enable
# app.plugins.setEnable(true); app.plugins.enablePlugin('visit-history')
```
- Tarball layout GOTCHA: extracts to `obsidian-<version>/obsidian`, NOT `Obsidian/obsidian`
  (blueprint guessed wrong). Fixed in setup-obsidian-bin.sh.
- `obsidian.json` in user-data-dir: `{vaults:{<id>:{path,ts,open:true}},updateDisabled:true}`.
- Window-size `<vaultId>.json` hack NOT needed — all focus driving is via `app.workspace`
  APIs in `page.evaluate`, not clicks, so headless window size is irrelevant.

## Key implementation decisions
- **Per-test fresh Obsidian**: each spec calls `ObsidianHarness.launch({idleTimeoutSeconds})`
  in beforeEach, `close()` in afterEach. Unique runDir per launch → isolated vault copy.
  Chosen over a shared instance because each test needs a different idle value + isolation.
- **REPO_ROOT = process.cwd()** in harness (NOT `__dirname` — undefined under
  `"type":"module"` ESM; playwright.config.ts also can't use `__dirname`, so testDir is
  omitted (defaults to config dir) + outputDir is relative `../.tmp/e2e/output`).
- **noUncheckedIndexedAccess** forced: `PollResult.firstLine` (guaranteed present) instead
  of `lines[0]`; `parseDurationMs` guards `match()?.[1]`.
- **eslint**: added `e2e` + `.dev-vault` to globalIgnores in eslint.config.mts. WHY: typed
  linting (projectService) demanded type info for e2e files not in the src tsconfig → error.
  Consistent with existing `submodules`/`vitest.config.ts` ignores.

## Empirical findings (load-bearing)
- Recording writes within ~1s of the close event; bounded poll (250ms interval) is enough.
- **Settings-open does NOT end a session** (activeLeaf stays `markdown`) → S3 is
  behavior-capturing: assert A absent 2s after openSettings, then close settings + open B,
  poll A for the close. NEVER assert a Settings-triggered close.
- Idle test (idleTimeoutSeconds=5) genuinely took ~6s wall → real idle path exercised; D<5000.
- Switching to a DIFFERENT tracked doc finalizes the prior doc's close IMMEDIATELY (no 10s
  grace) — matches PLAN_REVIEWER inline fix. The 10s grace-expiry path is UNCOVERED (ticketed).

## Commands
- `npm run test:e2e` (full: setup-bin → setup:dev-vault build → tsc → playwright).
- `npm run test:e2e -- focusSwitch.e2e.ts` to run one spec.
- `npx tsc -p e2e/tsconfig.json` to typecheck specs only.
- Throwaway spikes live at `.tmp/spike.mjs` / `.tmp/spike2.mjs` (gitignored scratch).

## If re-run fails
- "DevTools endpoint timeout" → check OBSIDIAN_E2E_EXTRA_ARGS has the Ozone flags and
  OBSIDIAN_PATH is set (run-e2e.sh sets both automatically).
- Missing runtime libs would surface as an early child exit — none seen here.
