# PLANNER__PRIVATE — e2e-visit-history (rehydration memory)

Status: DETAILED_PLANNING complete. Plan at `DETAILED_PLANNING__PUBLIC.md` (same dir).

## What I did
- Read all 5 context docs (EXPLORATION_/A/B, CLARIFICATION, blueprint, TOP_LEVEL_AGENT).
- Verified source facts in repo (not just trusting exploration):
  - localStorage keys: `obsidian-vh-user-name` (UserNameProvider.ts:44), `obsidian-device-name`
    (DeviceNameProvider.ts:14). Raw `window.localStorage`, device-scoped.
  - `UNFOCUS_GRACE_MS = 10_000` (FocusDurationTracker.ts:21). Idle live-read via
    `() => plugin.settings.idleTimeoutSeconds*1000` (PluginFactory.ts:135).
  - FocusTracker: unfocus fires ONLY on `active-leaf-change` when focused FILE PATH changes
    (handleLeafChange:113-133). Modal (Settings) does not change active leaf → likely NO unfocus.
  - IsTrackedProvider tracks view types markdown/canvas/excalidraw; excludes __visit_history.
- Ran container feasibility probes (KEY de-risk for Milestone 1):
  - Debian 12 bookworm, x86_64, Node v20.20, headless (no DISPLAY/WAYLAND).
  - Network to github obsidian-releases = 302 OK.
  - ALL Chromium/Electron libs present under /usr/lib/x86_64-linux-gnu (libnss3, libgtk-3,
    libgbm, libasound2, libatk*, libxkbcommon, libdrm, libcups, libX*, libxcb, libdbus).
    NOTE: `ldconfig -p` returns 0 lines in this shell (misleading) — use `find` to verify libs.
  - /dev/shm = 1GB. Non-root uid 1000, NO sudo (cannot apt install). Xvfb NOT present.
  - Verdict: headless real-Obsidian PLAUSIBLE; Milestone 1 spike still gates (CDP attach + Ozone
    boot of fused Electron unproven until actually run).

## Key decisions baked into the plan
- **Determinism spine:** plugin present but NOT auto-enabled (`community-plugins.json=[]`);
  harness sets localStorage pins + writes data.json BEFORE `enablePlugin` → plugin onLayoutReady
  cb fires after pin exists → modal bypassed WITHOUT leveldb pre-seed. This is the crux.
- Drive focus via `app.workspace.getLeaf().openFile` / `app.setting.open()` in `page.evaluate`
  (NOT clicks) → headless window-size irrelevant.
- On-disk assertions only, via bounded `pollForSessionLine` (regex `^\S+ D:\d+$`), never sleeps.
- S2 "close" = graceful `disablePlugin` (onunload→dispose flush) NOT process-kill (kill races
  async append = documented limitation).
- Per-test data.json idle: 180 for grace tests (S1-S4), 5 for idle test (S5). S5 asserts D<5000
  (idle ends at last activity) — meaningful, not just "line exists".
- Milestones: 1=feasibility spike (HARD GATE, fallback in §7 if fails), 2=harness+scripts+S1
  green + empirically probe Settings behavior, 3=S2-S5, 4=wire-up/docs/gitignore/tickets.
- @playwright/test pinned; DO NOT run `playwright install` (we connectOverCDP to Obsidian's
  Electron, not Playwright's chromium).

## Open question raised (§10, #QUESTION_FOR_HUMAN)
- "Switch to Settings" semantics: Settings is a modal → mechanically may NOT close a session.
  Asked human whether opening Settings should close/record the current doc's session. S3 spec
  written to empirically-observed truth; if it doesn't close and human expected it to → ticket
  as product gap. Owner decision — did not invent.

## Files the plan specifies (manifest)
NEW: scripts/setup-obsidian-bin.sh, scripts/run-e2e.sh, e2e/playwright.config.ts,
e2e/tsconfig.json, e2e/setupDevVault.mjs, e2e/obsidianHarness.ts, e2e/constants.ts,
e2e/vhAssert.ts, e2e/{focusSwitch,closeUnloadFlush,switchToSettings,canvasFocus,idleTimeout}.e2e.ts,
.dev-vault/{A.md,B.md,C.canvas,.obsidian/*}.
EDIT: package.json (@playwright/test devDep + test:e2e/setup:obsidian/setup:dev-vault scripts),
.gitignore (.dev-vault/.obsidian/plugins/), CLAUDE.md + docs note (cache mount + env overrides).
Seeded ids: A=docid_aaaa…_e (24 a), B=…bbbb…, C=…cccc… → deterministic .vh_v3 filenames.

## Tickets deferred (not in scope now)
CI e2e workflow; Dockerfile/compose w/ named-volume cache; provision xvfb fallback; conditional
"settings-doesn't-end-session" product ticket; optional synchronous flush test seam.

## If rehydrating: next stage is DETAILED_PLAN_REVIEW (PLAN_REVIEWER), then iteration.
```
