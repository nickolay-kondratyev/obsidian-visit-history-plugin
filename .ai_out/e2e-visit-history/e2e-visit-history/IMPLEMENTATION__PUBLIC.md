# IMPLEMENTATION__PUBLIC — Real-Obsidian Playwright e2e for Visit History

## Result headline
**M1 GATE: PASS.** Real headless Obsidian 1.12.7 boots in this container, CDP attaches,
`window.app` + `layoutReady` are reachable, the built plugin enables, and it writes real
`.vh_v3` session files to disk. **All 5 scenario specs pass** (`5 passed (17.1s)`),
serially, against real Obsidian. `npm test` (vitest) still green (386 passed). `npm run
lint` = 0 errors.

## M1 feasibility evidence (proven, not assumed)
Two throwaway spikes (`.tmp/spike.mjs`, `.tmp/spike2.mjs`) proved the pipeline before the
harness was written:
- `SPIKE OK: app+layout+plugin reachable` — boot + CDP attach + plugin enable.
- Recording works end-to-end: after opening `A.md` (dwell ~1.2s) then switching to `B.md`,
  the plugin wrote
  `__visit_history/user/e2e_user/v3/focus_duration_per_device/e2e_device/docid_aaaaaaaaaaaaaaaaaaaaaaaa_e.vh_v3`
  containing exactly `2026-07-21T16:19:21.906Z D:1215`.
- **Settings empirical probe (M2 requirement):** opening Settings via `app.setting.open()`
  did NOT change the active leaf (`markdown` before and after) and did NOT close/record the
  focused doc's session. This is the observed truth S3 encodes.

Launch invocation that works (headless, non-root, no sudo):
`obsidian --no-sandbox --user-data-dir=<throwaway> --remote-debugging-port=0
--ozone-platform=headless --disable-gpu`, with a pre-written `<userData>/obsidian.json`
registering the vault; endpoint parsed from the `DevTools listening on ws://…` stderr line;
`chromium.connectOverCDP(endpoint)`.

## Files built
Scripts:
- `scripts/setup-obsidian-bin.sh` — download+cache pinned Obsidian 1.12.7 `.tar.gz`
  (x86_64/arm64), stdout=binary path, logs→stderr, second run reuses cache. NOTE: the
  tarball extracts to `obsidian-<version>/obsidian` (not `Obsidian/…` as the blueprint
  guessed) — corrected after inspecting the real tarball.
- `scripts/run-e2e.sh` — the `test:e2e` entry: ensure binary, inject headless Ozone flags
  when no DISPLAY, `setup:dev-vault`, `tsc -p e2e/tsconfig.json`, `playwright test`.

e2e/:
- `constants.ts` — duplicated runtime constants (plugin id, VH dir, localStorage keys,
  seeded ids, session regex) with a sync-pointer WHY comment. No `import "obsidian"`.
- `vhAssert.ts` — `.vh_v3` path builder + bounded `pollForSessionLine` (throws with
  last-seen content on timeout) + `parseDurationMs` + `sessionLines`.
- `obsidianHarness.ts` — `ObsidianHarness.launch({idleTimeoutSeconds})`: fresh `.dev-vault`
  copy → spawn → CDP attach → `layoutReady` → pin localStorage (before enable) → write
  per-test `data.json` → enable plugin. Helpers: `openFile`, `openSettings`,
  `closeSettings`, `disablePlugin`, `close`. `REPO_ROOT = process.cwd()` (ESM has no
  `__dirname`; run-e2e.sh cd's to repo root).
- `playwright.config.ts` — `testMatch **/*.e2e.ts`, `workers:1`, `fullyParallel:false`,
  `timeout 120s`, `expect.timeout 20s`, `outputDir ../.tmp/e2e/output`.
- `tsconfig.json` — strict, `noUncheckedIndexedAccess`, `types:["node"]`, noEmit.
- `setupDevVault.mjs` — build plugin + install main.js/manifest.json/styles.css into
  `.dev-vault/.obsidian/plugins/visit-history/`; fails fast if submodule/artifacts missing.
- Five specs: `focusSwitch.e2e.ts`, `closeUnloadFlush.e2e.ts`, `switchToSettings.e2e.ts`,
  `canvasFocus.e2e.ts`, `idleTimeout.e2e.ts`.

Seed vault `.dev-vault/` (committed): `A.md`, `B.md` (frontmatter `id:`), `C.canvas`
(`metadata.frontmatter.id` + one text node), `.obsidian/{app.json, community-plugins.json=[]}`.
The installed plugin build is gitignored (`.dev-vault/.obsidian/plugins/`).

Wire-up / hygiene:
- `package.json` — `@playwright/test` pinned `1.49.1`; scripts `setup:obsidian`,
  `setup:dev-vault`, `test:e2e`.
- `.gitignore` — ignores `.dev-vault/.obsidian/plugins/` (seed vault otherwise committed).
- `eslint.config.mts` — added `e2e` + `.dev-vault` to global ignores (node-side code runs
  OUTSIDE Obsidian, has its own tsconfig; mirrors the existing `submodules`/`vitest.config`
  ignores). This resolved a typed-linting error where obsidianmd rules demanded type info
  for e2e files not in the main tsconfig.
- `docs/e2e-testing.md` (+ linked from `docs/README.md`), `AGENTS.md`/CLAUDE.md dev section
  updated with `npm run test:e2e`.

## Scenario status (all PASS)
| Spec | Behavior asserted | How |
|------|-------------------|-----|
| S1 focusSwitch | A→B switch → A closes with exactly 1 line, `0≤D<60000`; B stays open (no line) | on-disk poll ≤15s; corrected mental model (different-doc focus finalizes A immediately, no 10s grace) |
| S2 closeUnloadFlush | graceful `disablePlugin` (onunload→dispose flush) → A flushed to 1 line | on-disk poll ≤15s; SIGKILL is a documented limitation, NOT asserted |
| S3 switchToSettings | **behavior-capturing (human decision):** Settings-open records NOTHING for A; A closes only on the later switch to B | assert A absent for 2s after `openSettings()`, then poll after switch to B |
| S4 canvasFocus | C.canvas records 1 line under its `metadata.frontmatter.id` path | on-disk poll ≤15s; proves `CanvasDocIdStore` read the seeded id |
| S5 idleTimeout | `idleTimeoutSeconds=5`; idle-close with `0≤D<5000` and elapsed<9s (not grace path) | on-disk poll ≤12s |

## Test run results
- `npm run test:e2e`: **5 passed** (17.1s), reproducible across 2 full runs.
- `npm test`: **386 passed** (39 files).
- `npm run lint`: **0 errors** (2 pre-existing warnings in `src/main.ts`, untouched).
- ACH.1 cache reuse: second run prints "Obsidian 1.12.7 already cached …" (no re-download).
- ACH.4: `grep` for `from 'obsidian'` under `e2e/`/`scripts/` = clean.

## Seams added
**None in plugin runtime code.** The suite asserts entirely on the on-disk `.vh_v3` files
via bounded polling — no test-only hooks were added to `src/`. (An optional flush seam is
ticketed as low priority.)

## Follow-up tickets filed (`_tickets/`)
- `e2e-ci-workflow-real-obsidian-headless.md`
- `e2e-dockerfile-compose-named-volume-cache.md`
- `vh-settings-open-does-not-end-session-product-question.md` (the #QUESTION_FOR_HUMAN)
- `e2e-grace-timer-expiry-spec.md` (uncovered 10s grace-expiry path)
- `e2e-optional-flush-test-seam.md`

## #QUESTION_FOR_HUMAN (non-blocking — ticketed)
Confirmed empirically: **opening Settings does NOT end the focused document's session** in
Obsidian 1.12.7 (modal doesn't change the active leaf or blur the window). S3 captures this
current behavior per your decision. Open owner question: is that the intended semantics, or
should opening Settings close/record the current session? See
`_tickets/vh-settings-open-does-not-end-session-product-question.md`.

## Blockers
None.
