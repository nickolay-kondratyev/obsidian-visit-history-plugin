# DETAILED_PLANNING — Real-Obsidian Playwright e2e for Visit History recording

Audience: IMPLEMENTATION agent. This is the "what" and "why"; you own the "how" at code level.
Do NOT duplicate exploration content — read first:
`EXPLORATION_PUBLIC.md`, `EXPLORATION_A_PUBLIC.md`, `EXPLORATION_B_PUBLIC.md`,
`CLARIFICATION__PUBLIC.md`, and the blueprint `.out/tmp_doc/e2e-obsidian-docker-setup.md`.

---

## 1. Problem understanding

Add a **real-Obsidian (Electron) Playwright e2e** setup to this plugin repo, following the
sanctioned blueprint (four pieces: `setup-obsidian-bin.sh`, `run-e2e.sh`, `obsidianHarness.ts`,
`playwright.config.ts`), plus **core e2e specs** proving Visit-History V3 recording for five
scenarios. Determinism comes from pinned identity (localStorage), pre-seeded doc ids, and a
fast idle setting; **assertions are on the on-disk `.vh_v3` files** (never plugin internals).

Constraints honored (from CLARIFICATION): portable scripts, no hard Dockerfile/CI (ticket
them), assert on disk, `obsidian` stays types-only in node-side code (duplicate constants),
never fake a pass.

### Feasibility pre-check (done by PLANNER in this container — de-risks Milestone 1)
This Linux sandbox is **Debian 12 (bookworm), x86_64, Node 20, headless** (no `DISPLAY`/
`WAYLAND_DISPLAY`). Verified present: network to `github.com/obsidianmd/obsidian-releases`
(HTTP 302 OK), `/dev/shm` = 1 GB, and **every** Chromium/Electron runtime lib checked
(`libnss3`, `libgtk-3`, `libgbm`, `libasound2`, `libatk*`, `libxkbcommon`, `libdrm`,
`libcups`, `libX*`, `libxcb`, `libdbus`, …) resolves under `/usr/lib/x86_64-linux-gnu`.
Non-root (uid 1000), **no sudo** → cannot `apt install` anything, but nothing appears to be
missing. **Conclusion: headless real-Obsidian is PLAUSIBLE here.** Milestone 1 still gates
everything because CDP-attach + Ozone-headless boot of the fused Electron build is unproven
until run. (`ldconfig -p` returns empty in this shell — misleading; `find` confirms the libs.)

---

## 2. High-level architecture of the e2e layer

```
package.json  ── scripts ──▶ scripts/run-e2e.sh
                               │  1. OBSIDIAN_PATH ?= setup-obsidian-bin.sh   (download+cache)
                               │  2. inject headless Ozone flags if no DISPLAY
                               │  3. npm run setup:dev-vault  (build plugin + install into .dev-vault)
                               │  4. tsc -p e2e/tsconfig.json  (typecheck specs)
                               └▶ npx playwright test --config e2e/playwright.config.ts

e2e/playwright.config.ts   workers:1, fullyParallel:false, long timeouts, outputDir under .tmp/
e2e/obsidianHarness.ts     fresh vault copy → spawn Electron (CDP) → attach → enable plugin
e2e/constants.ts           duplicated runtime constants (no `import "obsidian"`)
e2e/vhAssert.ts            on-disk .vh_v3 path builder + bounded poll helper
e2e/setupDevVault.mjs      build + copy main.js/manifest/styles into .dev-vault plugin dir
e2e/*.e2e.ts               the five scenario specs
.dev-vault/                committed seed vault (notes + canvas + minimal .obsidian)
```

Data/identity flow at runtime (the determinism spine):

```
fresh copy .dev-vault ─▶ .tmp/e2e/vault/<run>
   (seeded ids in A.md,B.md,C.canvas; minimal .obsidian; plugin present but NOT auto-enabled)
        │
   spawn Electron(user-data-dir=throwaway, obsidian.json→vault, --no-sandbox, Ozone flags,
                  --remote-debugging-port=0)  ── stderr "DevTools listening on ws://…"
        │
   chromium.connectOverCDP(ws)  ──▶ page (renderer, window.app reachable)
        │
   wait app.workspace.layoutReady
        │
   page.evaluate: window.localStorage.set('obsidian-vh-user-name','e2e_user'),
                  ('obsidian-device-name','e2e_device')        ◀── BEFORE enabling plugin
   fs.write .obsidian/plugins/visit-history/data.json = {"idleTimeoutSeconds": N}  (per test)
        │
   page.evaluate: app.plugins.setEnable(true); await app.plugins.enablePlugin('visit-history')
        │  ⇒ plugin onload → registers onLayoutReady cb → layout already ready → fires now
        │  ⇒ UserNameProvider reads localStorage → 'e2e_user' found → NO modal
        │  ⇒ activateUserScopedRecording('e2e_user') wires V3 duration listener
        │
   test drives focus via app.workspace APIs; asserts .vh_v3 on disk under .tmp/e2e/vault
```

**Why localStorage-before-enable is the whole game:** the user-name pin runs inside the
plugin's `onLayoutReady` callback. If the plugin is disabled at boot and enabled only after
we set localStorage, the callback fires *after* the pin exists → modal is bypassed
deterministically with **no leveldb pre-seeding** and no modal-dismiss race.
Requirement: `.dev-vault/.obsidian/community-plugins.json` = `[]` (plugin must NOT auto-load).

---

## 3. Milestone-ordered plan

### MILESTONE 1 — Feasibility spike (HARD GATE; everything below depends on it)
Goal: prove headless real-Obsidian is drivable in this container.
1. Write `scripts/setup-obsidian-bin.sh` (see §5.1) and run it → cached binary at
   `.tmp/obsidian/…/obsidian` (version pinned `1.12.7` per A6; arch = x86_64 tarball).
2. Minimal throwaway launch: spawn the binary with
   `--no-sandbox --remote-debugging-port=0 --ozone-platform=headless --disable-gpu
   --user-data-dir=<tmp>` and a pre-written `obsidian.json` opening a trivial vault.
3. Read `DevTools listening on ws://…` from **stderr**; `chromium.connectOverCDP(endpoint)`.
4. Assert in `page.evaluate`: `typeof window.app === 'object'` and eventually
   `app.workspace.layoutReady === true`.
5. Enable the built plugin at runtime and assert
   `app.plugins.plugins['visit-history']` is truthy.

**Exit criteria:** a throwaway script prints "SPIKE OK: app+layout+plugin reachable" against
real Obsidian, headless, in this container. **If it cannot boot/attach** (e.g. Ozone headless
unsupported by the fused build, or a missing lib surfaces at runtime): STOP, capture the exact
failure (stderr + which step), and report per protocol — propose the **fallback** in §7 rather
than faking. Do not proceed to Milestone 2 until this is green.

### MILESTONE 2 — Harness + scripts + first green scenario (focus switch)
Goal: the reusable harness and the simplest real spec passing end-to-end.
1. `scripts/run-e2e.sh`, `e2e/playwright.config.ts`, `e2e/tsconfig.json` (§5).
2. `.dev-vault/` seed (§4) + `e2e/setupDevVault.mjs` (build + install plugin).
3. `e2e/obsidianHarness.ts` (§6): fresh copy, spawn, CDP attach, layoutReady, localStorage
   pins, per-test `data.json`, enable plugin, and teardown (disable plugin / close CDP / kill).
4. `e2e/constants.ts` + `e2e/vhAssert.ts` (path builder + bounded poll helper).
5. **Scenario 1 spec** (`focusSwitch.e2e.ts`) green (§4.1 / §8-S1). This validates the whole
   pipeline including async-append polling.
6. **Empirical probe (needed for Milestone 3 Settings spec):** from a driver in this
   milestone, open Settings via `app.setting.open()` while doc A is focused and observe whether
   an `active-leaf-change`/unfocus occurs (poll A's `.vh_v3`, or check
   `app.workspace.activeLeaf` before/after). Record the observed truth — it decides the
   Settings spec shape and the `#QUESTION_FOR_HUMAN` in §10.

### MILESTONE 3 — Remaining four scenarios
Add specs (§8): `closeUnloadFlush.e2e.ts`, `switchToSettings.e2e.ts`, `canvasFocus.e2e.ts`,
`idleTimeout.e2e.ts`. Reuse harness + `vhAssert`. Each writes its own `data.json` idle value.

### MILESTONE 4 — Wire-up, docs, hygiene
1. `package.json`: add `@playwright/test` devDep + `test:e2e` / `setup:obsidian` /
   `setup:dev-vault` scripts (§5.5).
2. `.gitignore`: ignore built plugin artifacts under `.dev-vault` + e2e run dir (§5.6).
3. Short note in `docs/` (or README) on the named-volume cache mount (per A2 — a note, not a
   Dockerfile) and the `OBSIDIAN_PATH` / `OBSIDIAN_CACHE_DIR` / `OBSIDIAN_E2E_EXTRA_ARGS`
   overrides. Update `CLAUDE.md` dev-environment section with the `npm run test:e2e` entry.
4. File the follow-up tickets in §9.

---

## 4. Seed vault `.dev-vault/` (committed)

Deterministic content so `.vh_v3` filenames are known up front. Use literal, filename-safe,
format-valid ids (`docid_<24 base36 lowercase>_e`):

| File | Seeded id location | id (example) | Produced `.vh_v3` filename |
|------|--------------------|--------------|----------------------------|
| `A.md` | frontmatter `id:` | `docid_aaaaaaaaaaaaaaaaaaaaaaaa_e` | `docid_aaaaaaaaaaaaaaaaaaaaaaaa_e.vh_v3` |
| `B.md` | frontmatter `id:` | `docid_bbbbbbbbbbbbbbbbbbbbbbbb_e` | `docid_bbbbbbbbbbbbbbbbbbbbbbbb_e.vh_v3` |
| `C.canvas` | `metadata.frontmatter.id` | `docid_cccccccccccccccccccccccc_e` | `docid_cccccccccccccccccccccccc_e.vh_v3` |

- `C.canvas` JSON shape: `{"nodes":[],"edges":[],"metadata":{"frontmatter":{"id":"docid_cccccccccccccccccccccccc_e"}}}`
  (add one text node so the view has content to focus; keep the `metadata.frontmatter.id`).
- `.dev-vault/.obsidian/`: minimal — `app.json` (empty `{}` ok), `community-plugins.json` =
  `[]` (**must not auto-enable the plugin**), `core-plugins.json` with defaults, NO
  `workspace.json` (so boot opens an empty tab, not a tracked file → clean first `onFocus`
  comes only from the test's explicit `openFile`). Do **not** commit a `.obsidian/plugins/`
  build (gitignored — §5.6); `setup:dev-vault` installs it.
- Full path on disk after seeding & recording (assertion target):
  `.tmp/e2e/vault/__visit_history/user/e2e_user/v3/focus_duration_per_device/e2e_device/<id>.vh_v3`.

### 4.1 Deterministic focus driving (all specs)
Drive focus with **workspace APIs via `page.evaluate`, not clicks** — immune to headless
window-sizing, no `<vaultId>.json` size hack needed for these DOM-free flows:
```
await page.evaluate(async (p) => {
  const f = window.app.vault.getAbstractFileByPath(p);
  await window.app.workspace.getLeaf(false).openFile(f);
}, 'A.md');
await page.evaluate(() => window.app.workspace.whenIdle?.());  // optional settle
```
`openFile` fires `active-leaf-change` → `onFocus`. Switching to another path fires `onUnfocus`
for the prior file. Settings uses `app.setting.open()` / `app.setting.openTabById('visit-history')`.

---

## 5. File manifest — scripts, config, package edits

### 5.1 `scripts/setup-obsidian-bin.sh` (NEW) — per blueprint §1
- Pin `OBSIDIAN_VERSION=1.12.7`. Arch → `obsidian-<v>.tar.gz` (x86_64) /
  `-arm64.tar.gz`. **Use `.tar.gz`, not AppImage** (no FUSE in container).
- Cache dir env-overridable: `CACHE_DIR="${OBSIDIAN_CACHE_DIR:-$PWD/.tmp/obsidian}"`
  (repo-local default keeps it in already-gitignored `.tmp/`; shared XDG cache optional).
- If cached binary executable → print path, exit 0 (no re-download).
- Else `curl --fail --location` the release tarball → `tar -xzf` into cache → rm archive.
- **stdout = binary path ONLY; all logs to stderr** (caller does `OBSIDIAN_PATH="$(…)"`).
- Non-Linux → exit with actionable message (set `OBSIDIAN_PATH` yourself).

### 5.2 `scripts/run-e2e.sh` (NEW) — per blueprint §2
`set -euo pipefail`; cd repo root; ensure `OBSIDIAN_PATH` (call 5.1 if unset); if no
`DISPLAY`/`WAYLAND_DISPLAY` and `OBSIDIAN_E2E_EXTRA_ARGS` unset →
`export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"`; then
`npm run setup:dev-vault` → `npx tsc -p e2e/tsconfig.json` →
`exec npx playwright test --config e2e/playwright.config.ts "$@"`.

### 5.3 `e2e/playwright.config.ts` (NEW)
`testMatch:"**/*.e2e.ts"`, `workers:1`, `fullyParallel:false`, `retries:0`,
`timeout:120_000`, `expect.timeout:20_000`, `outputDir:".tmp/e2e/output"`. No `webServer`, no
Playwright browsers (we `connectOverCDP` to Obsidian's Electron — **do not** run
`playwright install`; note this in the runbook).

### 5.4 `e2e/tsconfig.json` (NEW)
`target ES2021`, `module ESNext`, `moduleResolution node` (or `bundler`), `strict`, `types:
["node","@playwright/test"]`, `include:["e2e/**/*.ts"]`, `noEmit`. **No `obsidian` type dep**
in e2e — `window.app` is accessed inside `page.evaluate` string bodies (typed loosely / via a
minimal local `declare` if needed), never `import "obsidian"`.

### 5.5 `package.json` (EDIT)
- devDependency: `"@playwright/test"` pinned to a known-good stable (e.g. `1.49.x`; the
  implementer picks the latest that installs cleanly on Node 20 and pins it — floating breaks
  e2e silently, matching the version-pin rationale).
- scripts:
  - `"setup:obsidian": "bash scripts/setup-obsidian-bin.sh"`
  - `"setup:dev-vault": "node e2e/setupDevVault.mjs"`
  - `"test:e2e": "bash scripts/run-e2e.sh"`

### 5.6 `.gitignore` (EDIT)
Add: `.dev-vault/.obsidian/plugins/` (installed build artifacts — not committed) and
`.tmp/e2e/` is already covered by the existing `.tmp/` ignore. Keep the rest of `.dev-vault`
committed (notes, canvas, minimal `.obsidian` config).

### 5.7 `e2e/setupDevVault.mjs` (NEW)
Node ESM script (KISS — no compile step): run `npm run build` (or fail fast if `main.js`
missing), then copy `main.js` + `manifest.json` + `styles.css` into
`.dev-vault/.obsidian/plugins/visit-history/`. Fail fast with a clear message if the built
`main.js` or the submodule is missing (`git submodule update --init` reminder).

### 5.8 `e2e/constants.ts` (NEW) — duplicated runtime constants (DRY across specs/harness)
`PLUGIN_ID='visit-history'`, `VH_TOP_DIR='__visit_history'`, `USER='e2e_user'`,
`DEVICE='e2e_device'`, localStorage keys (`obsidian-vh-user-name`, `obsidian-device-name`),
seeded ids (A/B/C above), `SESSION_LINE_RE=/^\S+ D:\d+$/m`, tracked view types. WHY comment:
`obsidian` is types-only → these MUST be duplicated, not imported (keep in sync with
`src/Constants.ts` / `VhV3Paths` / `VhUserPaths` — reference them in the comment).

### 5.9 `e2e/vhAssert.ts` (NEW) — path builder + bounded poll
- `vhFilePath(vaultDir, docId)` → the full `__visit_history/user/e2e_user/v3/
  focus_duration_per_device/e2e_device/<docId>.vh_v3`.
- `pollForSessionLine(file, {timeoutMs, intervalMs=250})`: read file until content has a line
  matching `SESSION_LINE_RE`; return the matched line(s). Throws with the last-seen content on
  timeout (no silent pass). **Bounded polling, never fixed sleeps masking the async append.**
- `parseDurationMs(line)` → integer from `D:(\d+)`.

---

## 6. `e2e/obsidianHarness.ts` (NEW) — mechanics (per blueprint §3)

Responsibilities (a small class/factory, SRP):
1. **Fresh vault per run:** `cpSync('.dev-vault' → '.tmp/e2e/vault-<runId>')`; delete any
   stray plugin `data.json`; the caller/harness then writes the per-test `data.json`.
2. **Pre-write** `<userDataDir>/obsidian.json` registering the copied vault
   (`open:true, updateDisabled:true`) → boots straight in, no picker, no auto-update.
3. **Spawn** `OBSIDIAN_PATH` with: `--no-sandbox`, `--user-data-dir=<throwaway>`,
   `--remote-debugging-port=0`, plus **`OBSIDIAN_E2E_EXTRA_ARGS` split on whitespace**
   (carries the Ozone headless flags). Optionally pre-write `<userData>/<vaultId>.json`
   `{width,height,zoom}` for a sane window size (only needed if any spec ever clicks; the
   API-driven specs don't).
4. **Attach:** scan child **stderr** for `DevTools listening on (ws://\S+)`;
   `chromium.connectOverCDP(endpoint)`; take the first context/page (or wait for it).
5. **Wait** `page.waitForFunction(() => window.app?.workspace?.layoutReady === true)`.
6. **Pin identity + settings BEFORE enable:** `page.evaluate` sets both localStorage keys;
   `fs.writeFile` the plugin `data.json = {"idleTimeoutSeconds": N}` (N per test).
7. **Enable plugin:** `page.evaluate(async () => { await window.app.plugins.setEnable(true);
   await window.app.plugins.enablePlugin('visit-history'); })`; then
   `waitForFunction(() => !!window.app.plugins.plugins['visit-history'])`.
8. **Expose** `page`, `vaultDir`, and helpers to specs.
9. **Teardown:** for graceful unload-flush tests, `disablePlugin` (see S2); always
   `close CDP` + kill child on fixture teardown. Use a Playwright fixture or
   `test.beforeEach/afterEach` so `workers:1` guarantees one Obsidian at a time.

Note: enable with an **empty workspace** (no tracked file open at enable time), so the first
tracked `onFocus` comes only from the spec's explicit `openFile` — avoids relying on
`replayLastFocusTo`. (Replay still works if a doc were pre-open; we simply don't depend on it.)

---

## 7. Fallback if Milestone 1 fails (headless real-Obsidian infeasible here)

State it **loudly** in the report; do not fake. Options, in Pareto order:
1. **`xvfb-run` virtual display** instead of Ozone headless — but `Xvfb`/`xvfb-run` are NOT
   present here and we cannot `apt install` (no sudo). Viable only if the human provisions the
   image. Ticket it.
2. **Deliver the setup, mark the suite CI-only:** commit scripts + harness + specs exactly per
   blueprint (they "work in Docker" per the blueprint), and document that `npm run test:e2e`
   requires a display-capable/CI container. Prove as much as possible locally (download+extract
   binary, typecheck, dry-run harness up to the spawn). Be explicit that specs are unverified
   in THIS sandbox and why. This preserves value without a fake green.
3. Escalate to the human with the exact blocking stderr for an image change (add Xvfb or the
   missing lib). This is the honest EARN_TRUST path if 1–2 are unacceptable.

---

## 8. Spec design & acceptance criteria (the five scenarios)

Common: `idleTimeoutSeconds` written per test. Switch/unload tests (S1–S4) use a **high** idle
(e.g. `180`) so the idle timer never fires during the (brief) dwell before the switch. S5 uses
`5`.
> [PLAN_REVIEWER inline fix] Note: S1–S4 close via different-doc focus / disable, NOT via
> grace-timer expiry (see S1/S4 corrections) — the "high idle vs 10 s grace" framing does not
> apply to the switch tests.
All assertions read the on-disk `.vh_v3` via `pollForSessionLine`. Duration sanity is
**bounded, not exact** (timing is inherently jittery): assert format + line count + a loose
range. One logical assert per behavior.

### S1 — Switching focus between documents (`focusSwitch.e2e.ts`)
Drive: open `A.md` → (brief dwell) → open `B.md`. A's file path changes → `onUnfocus(A)` →
A session closes (stamped at unfocus moment).
> [PLAN_REVIEWER inline fix] Corrected mechanism: switching to a DIFFERENT tracked doc does
> NOT wait the 10 s grace. `FocusDurationTracker.onDocFocused(B)` calls `finalizePendingClose()`
> immediately (FocusDurationTracker.ts:146), closing A at its original unfocus stamp right away.
> So A's `.vh_v3` appears within the async-append budget (~1 s), not ~10 s. The ~15 s poll
> budget in AC1.1 is still valid (it is an upper bound), but the implementer should NOT wait for
> or assume a 10 s delay here, nor read a prompt close as a bug. The 10 s grace-timer EXPIRY
> path (an unfocus NOT followed by another tracked-doc focus) is exercised by NONE of the five
> required scenarios — ticket a dedicated grace-expiry spec (see §9), out of scope now.
- **AC1.1** Within a ~15 s budget, `A`'s `.vh_v3` exists and contains **exactly one** line
  matching `^\S+ D:\d+$`.
- **AC1.2** That line's `D:` parses to an integer with `0 <= D < 60000`.
- **AC1.3** `B`'s `.vh_v3` does NOT yet contain a closed line while B stays focused
  (B's session is still open) — proves per-doc isolation. (Assert absence within a short bound;
  acceptable because S1's positive path already proves the writer works.)

### S2 — Closing Obsidian / unload flush (`closeUnloadFlush.e2e.ts`)
Per exploration, hard process-kill races the async append and may lose the last session.
Canonical test drives the **same `onunload` → `factory.dispose()` flush** deterministically:
open `A.md`, then `page.evaluate(() => window.app.plugins.disablePlugin('visit-history'))`
(runs `onunload` while the process stays alive so the append completes).
- **AC2.1** After disable, `A`'s `.vh_v3` contains exactly one valid session line (poll ≤15 s).
- **AC2.2** `D:` parses to `0 <= D < 60000`.
- Note (not an assertion): a real `SIGKILL` variant is a **documented limitation** (may lose
  the open session) — do NOT write a flaky kill-based assertion.

### S3 — Switching to Settings (`switchToSettings.e2e.ts`)
**Behavior is empirically determined in Milestone 2** (Settings is a modal; `onUnfocus` fires
only on `active-leaf-change` with a file-path change — opening a modal may NOT fire it). Write
the spec to the **observed truth**:
- If Settings-open DOES close A (active-leaf-change to untracked/null): **AC3.1** open `A.md` →
  `app.setting.open()` → within ~15 s A's `.vh_v3` has exactly one valid line; `0 <= D < 60000`.
- If Settings-open does NOT close A: the spec asserts the honest behavior — open `A.md` →
  `app.setting.open()` → close settings → open `B.md`; A closes on the B-switch (grace) with one
  valid line — and the "settings alone does not end a session" finding is raised in §10 +
  ticketed (§9). **Do not** assert a close that the product doesn't perform.

### S4 — Focus in a canvas (`canvasFocus.e2e.ts`)
Drive: open `C.canvas` (dwell) → open `A.md` (unfocus C) → C closes.
> [PLAN_REVIEWER inline fix] Same correction as S1: the switch to `A.md` finalizes C's pending
> close immediately (different-doc focus), so C's `.vh_v3` appears promptly — no 10 s grace wait.
> AC4.1's ~15 s budget stays valid as an upper bound.
- **AC4.1** `C`'s `.vh_v3` (filename = canvas id) exists with exactly one valid line (poll ≤15 s).
- **AC4.2** `D:` parses to `0 <= D < 60000`.
- **AC4.3** Confirms canvas doc-id path: file lives under
  `…/e2e_device/docid_cccccccccccccccccccccccc_e.vh_v3` (proves `CanvasDocIdStore` read the
  seeded `metadata.frontmatter.id`).

### S5 — Unfocus on idle (`idleTimeout.e2e.ts`) — fast idle
Per-test `data.json = {"idleTimeoutSeconds": 5}`. Drive: open `A.md`, send NO input.
Idle path has **no 10 s grace**: at 5 s of inactivity the session closes, duration ends at last
activity (idle tail not counted).
- **AC5.1** Within ~12 s (5 s idle + append + margin), `A`'s `.vh_v3` has exactly one valid line.
- **AC5.2** `D:` parses to `0 <= D < 5000` (idle-close ends at last activity, strictly below the
  5 s idle window — proves the idle tail is not counted, not just "a line exists").
- **AC5.3** (guards against grace-path false positive) the line must appear **before** the 10 s
  grace could apply — i.e. the poll succeeds within the idle budget (assert elapsed < ~9 s).
- Optional strengthening (only if trusted input works headless): dispatch one synthetic
  `keydown` ~2 s after focus via `page.evaluate` so `D` is provably `>0` yet `<5000`. Keep
  optional — do not let untrusted-event flakiness fail the suite.

### Harness/scripts acceptance
- **ACH.1** `bash scripts/setup-obsidian-bin.sh` prints an executable binary path; a second run
  reuses the cache (no re-download).
- **ACH.2** `npm run setup:dev-vault` produces
  `.dev-vault/.obsidian/plugins/visit-history/main.js` (+ manifest + styles).
- **ACH.3** `npm run test:e2e` runs the whole suite green in this container (or, if Milestone 1
  fails, the §7 fallback is delivered + reported — never a fake green).
- **ACH.4** No `import … from 'obsidian'` anywhere under `e2e/` or in the scripts
  (`grep` clean) — constants duplicated in `e2e/constants.ts`.
- **ACH.5** `.tmp/e2e/` used for all run artifacts; the human's real vault is never touched.

---

## 9. Follow-up tickets (do NOT expand scope now)
- **CI e2e job** (`.github/workflows`): submodule init + build + Obsidian binary cache
  (named volume) + headless Ozone; matrix optional. (A3)
- **Dockerfile / compose** with the named-volume cache mount, if the human wants reproducible
  CI beyond the portable scripts. (A2)
- **Provision `xvfb`** in the dev image as a fallback display path (only if Milestone 1's Ozone
  headless proves unreliable).
- **(Conditional) Settings-does-not-end-session**: if Milestone 2 confirms opening Settings
  leaves the session open, ticket the product question (is that intended?) — see §10.
- **Optional flush hook**: a DOM-reachable synchronous "flush now" test seam would remove
  append-polling from e2e (currently mitigated by bounded polling). Low priority.
- **[PLAN_REVIEWER] Grace-timer-expiry spec** (not covered by the 5 required scenarios): a spec
  that unfocuses a doc WITHOUT switching to another tracked doc (e.g. switch to an empty/
  untracked leaf, or blur the window) then waits out `UNFOCUS_GRACE_MS` (10 s) to prove the
  grace-expiry close path and the same-doc-refocus-within-grace cancel. Low priority.

---

## 10. #QUESTION_FOR_HUMAN

**Intended semantics of "switch to Settings" (Scenario 3).** Mechanically, the plugin ends a
session only on: navigation to a different/untracked *leaf* (`active-leaf-change`, 10 s grace),
the hosting window's OS blur, idle timeout, or unload. The Settings **modal** does not change
the active leaf and does not blur the OS window, so opening Settings may **not** end the
current document's session by itself (Milestone 2 will confirm empirically against Obsidian
1.12.7). **Do you expect opening Settings to close/record the current document's session?**
- If **yes** and it doesn't → that's a product gap (bug/feature), and the e2e should encode the
  true current behavior while we ticket the gap (S3 fallback shape).
- If **no** (settings is just an overlay; the session legitimately continues until real nav/
  idle/unload) → S3 asserts that continuation + the eventual close on switching to `B.md`.

This is an owner decision (matches the CLAUDE.md pattern of owner-decided session semantics);
the planner will not invent the intended behavior.

---

## 11. Trade-offs & risks

| Risk | Mitigation |
|------|------------|
| Headless Electron/Obsidian may not boot/attach in this container | Milestone 1 hard gate + §7 fallback; feasibility pre-check already green on libs/network. |
| Timing flakiness (grace 10 s, async append) | Bounded `pollForSessionLine` (never fixed sleeps); generous `expect.timeout` 20 s; `workers:1`, serial. |
| Idle floor is 5 s (can't go faster) | Accepted; S5 budgets ~12 s. Suite stays serial so total time is bounded. |
| Hard-quit loses last open session | S2 tests the **graceful** `disablePlugin` flush path; process-kill is a documented limitation, not an assertion. |
| Exact durations are jittery | Assert **bounded** ranges + line count + format, not exact ms (S5 uses the meaningful `<5000` bound). |
| Headless window ~300×200 → clicks miss | Drive focus via `app.workspace`/`app.setting` APIs in `page.evaluate`, not clicks → window size irrelevant. Pre-write `<vaultId>.json` size only if a future click-based test needs it. |
| CDP attach reliability (`_electron.launch` hangs on fused build) | `connectOverCDP` on `--remote-debugging-port=0`, endpoint parsed from stderr — per blueprint, verified pattern. |
| `obsidian` imported at runtime in e2e (would crash — types-only) | `e2e/constants.ts` duplicates constants; ACH.4 greps to enforce. |
| Version drift breaks e2e silently | Pin Obsidian `1.12.7` and `@playwright/test`; bumps are deliberate. |
| Plugin auto-enables before localStorage set (modal race) | `community-plugins.json = []`; enable only AFTER pins set. |
| Settings-open behavior unknown | Empirically probed in Milestone 2 + §10 question; spec written to observed truth, never a faked close. |
```
