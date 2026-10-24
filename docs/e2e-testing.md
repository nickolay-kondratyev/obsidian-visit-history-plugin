# End-to-end testing (real Obsidian + Playwright)

The `e2e/` suite drives a **real headless Obsidian (Electron)** and asserts on the
on-disk `.vh_v3` files the plugin actually writes — never on plugin internals. It proves
Visit-History V3 recording across several scenarios: focus switch, unload flush, opening
Settings (ends the session; re-opens on close), opening the heatmap
(`switchToHeatmap.e2e.ts`; grace expiry) and refocusing the doc within the grace
(`heatmapRefocusWithinGrace.e2e.ts`; one continued session), Obsidian window blur/refocus
(`windowBlur.e2e.ts`), a doc in a popout window (`popoutWindowBlur.e2e.ts`), canvas focus,
idle timeout, a sub-floor idle timeout via a dev overrides file, the minimum focus time
(`minFocusToRecord.e2e.ts`), real input resuming after
an idle close (`idleResumeOnInput.e2e.ts`), a doc already open when the plugin is enabled
(`docOpenAtPluginEnable.e2e.ts`), first focus of an id-less note
(`firstFocusAssignsDocId.e2e.ts`), the first-run user-name modal — cancel records nothing,
confirm records under the new name (`userNameModal.e2e.ts`),
the interim-top-dir → `.plugin_data/visit_history` migration (`pluginDataMoveMigration.e2e.ts`),
the inline-note key journey (`inlineNote.e2e.ts`: content moved, note2 trashed, history merged in),
inlining via the embed icon in live preview (`inlineNoteEmbedIcon.e2e.ts`),
heatmap touch taps with REAL touch input (`heatmapTouchTap.e2e.ts`: tap a file → details
card, tap Open → file active; writes a card screenshot to `.out/`), a horizontal swipe on
the heatmap canvas in Obsidian's mobile UI panning without opening the side drawer
(`heatmapMobileSwipe.e2e.ts`; `ObsidianHarness.emulateMobile`),
heatmap tile labels for many long Chinese + Latin names
(`heatmapLabelsScreenshot.e2e.ts` — journey assert only; writes fitted + zoomed
screenshots to the git-ignored `.out/` for human review), and the heatmap's
clustered-timestamps banner — shown on a vault whose notes share one modified time, absent
when the times are spread (`heatmapClusteredTimestamps.e2e.ts`).

## Run it

```bash
npm run test:e2e                     # Linux/Docker: auto-downloads a pinned Obsidian, runs headless
npm run test:e2e -- focusSwitch.e2e.ts   # extra args pass through to Playwright
```

`test:e2e` (→ `scripts/run-e2e.sh`) ensures an Obsidian binary exists, injects headless
Ozone flags when there is no display, seeds `.dev-vault` with the freshly built plugin,
typechecks the specs (`e2e/tsconfig.json`), then runs Playwright serially (one Obsidian
window at a time).

> Do NOT run `playwright install` — the suite attaches to Obsidian's own Electron over
> CDP; no Playwright-managed browsers are used.

## How it works

- **`scripts/setup-obsidian-bin.sh`** — downloads + caches the pinned Obsidian
  (`1.12.7`) `.tar.gz` (a plain runnable binary; no FUSE/AppImage). stdout = the binary
  path; a second run reuses the cache.
- **`e2e/obsidianHarness.ts`** — per launch: copies `.dev-vault` fresh, spawns Obsidian
  with an isolated `--user-data-dir` + `--remote-debugging-port=0`, parses the
  `DevTools listening on ws://…` line from stderr, `connectOverCDP`, waits for
  `layoutReady`, pins identity in localStorage (`obsidian-vh-user-name=e2e_user`,
  `obsidian-device-name=e2e_device`) **before** enabling the plugin (so the first-run
  user-name modal is bypassed deterministically), writes the per-test `data.json`
  (`idleTimeoutSeconds`), then enables the plugin.
- **`e2e/vhAssert.ts`** — builds the expected `.vh_v3` path and polls it with a bounded
  timeout (never a fixed sleep); throws with the last-seen content on timeout.
- Assertions target
  `.tmp/e2e/vault-<run>/.plugin_data/visit_history/user/e2e_user/v3/focus_duration_per_device/e2e_device/<doc-id>.vh_v3`.
  The human's real vault is never touched.

`obsidian` is a types-only package, so the node-side e2e code never imports it —
runtime constants (plugin id, VH dir, localStorage keys, seeded ids, session regex) are
duplicated in `e2e/constants.ts` with a sync-pointer comment.

## Clicking inside the workspace

Most specs drive Obsidian via `window.app` only. A spec that CLICKS in the workspace
(e.g. `inlineNoteEmbedIcon.e2e.ts`) must first enlarge the headless window — it boots at
300×200 — with `page.setViewportSize`, and call `harness.trustVaultAuthor()`: Obsidian's
first-open "Do you trust the author of this vault?" modal stays up (the plugin is enabled
programmatically) and intercepts every pointer event.

## Real touch input

Playwright's `hasTouch` cannot be set after `connectOverCDP`, so a touch spec opens its own
CDP session: `Emulation.setTouchEmulationEnabled({ enabled: true })` once, then
`Input.dispatchTouchEvent` `touchStart` + `touchEnd` per tap — Chromium turns these into
real `pointerType: 'touch'` pointer events + the tap's click (see `heatmapTouchTap.e2e.ts`).
Never substitute mouse events: they take the mouse path.

## First-run user-name modal

`launch({ ..., leaveUserNameUnpinned: true })` skips the user-name localStorage pin (the
device name is still pinned), so the plugin's user-name modal opens on enable and nothing
is recorded until a name is confirmed. That modal stacks ABOVE the trust modal, so a spec
can click it without `trustVaultAuthor()` (still needs `setViewportSize`).
`vhFilePath(vaultDir, docId, userName)` targets a name chosen in the modal.

## Doc open before the plugin is enabled

`launch({ ..., openFileBeforeEnable: FILE_A })` opens that file in the active leaf (and
waits until it is active) BEFORE enabling the plugin — models a fresh enable / update
reload / hot-reload with a doc already open, where no `active-leaf-change` reaches the
plugin for it. Absent → nothing is opened.

## Popout windows

`openFileInPopout(path)` opens a real popout (works headless on 1.12.7) and activates its
leaf; `blurWindowHosting(path)` dispatches a synthetic `blur` on whichever window shows
`path` (same caveat as `blurWindow` below).

## Seeding legacy layouts (migration specs)

`ObsidianHarness.launch` takes an optional `seedFiles: SeedFile[]` — vault-relative
`{ path, content }` files written into the fresh copy **before** the plugin is enabled, so
its onload migrations observe them on disk. `pluginDataMoveMigration.e2e.ts` uses this to
seed a live `__visit_history/…/<id>.vh_v3` + README plus a non-matching leftover, then
asserts the third top-dir migration (`VhPluginDataMoveMigrationService`): the `.vh_v3` +
README move under `.plugin_data/visit_history/…` (content byte-preserved), the leftover
stays, now-empty legacy subdirs are pruned, and `__visit_history/` itself is removed only
when nothing remains in it. `vhAssert.pollUntil` waits on these on-disk end-states with a
bounded timeout (never a fixed sleep).

A seed file's optional `mtimeMs` sets its modified time (`utimes`) before Obsidian starts,
so the vault scan reads it — `heatmapClusteredTimestamps.e2e.ts` seeds one shared vs.
spread-out times. Created time cannot be set from Node.

## Dev config overrides (bypass hard-limited config)

Some config is hard-limited for safety — e.g. `idleTimeoutSeconds` is clamped to a min-5 s
floor at the settings boundary, so `data.json` cannot drive a fast idle close. To exercise
those paths, a test passes `devConfigOverrides` to the harness:

```ts
const getHarness = useHarness(/* settings idle */ 180, { idleTimeoutSeconds: 1 });
```

The harness writes those overrides to `<run-dir>/dev-config-overrides.json` and sets the
env var `__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__` to that path on the spawned
Obsidian process. The plugin's `ConfigProvider` reads the file once at load and lets an
override win over the persisted setting **without re-clamping** — so a sub-floor value
(e.g. 1 s) is honored. The mechanism is inert in production: normal users never set the
env var, so `ConfigProvider` just returns live settings values. `idleTimeoutOverride.e2e.ts`
uses this to close a session in ~1 s, well under the 5 s floor. Env-var name lives in
`src/core/config/DevOverridesFileSource.ts` (duplicated in `e2e/constants.ts`).

## Overridable env vars

| Var | Effect |
|-----|--------|
| `OBSIDIAN_PATH` | Use this binary; skip the auto-download (required on macOS/Windows). |
| `OBSIDIAN_CACHE_DIR` | Where the binary is downloaded/reused (default `.tmp/obsidian`). |
| `OBSIDIAN_E2E_EXTRA_ARGS` | Extra Electron flags (defaults to the headless Ozone flags when no `DISPLAY`). |

## CI / Docker

The scripts are portable and "just work" in a display-less Linux container. For CI,
mount the binary cache as a named volume so the download is reused across runs:

```
-v obsidian-e2e-cache:/home/<user>/.cache/obsidian-e2e   # with OBSIDIAN_CACHE_DIR set to it
```

A dedicated CI workflow + Dockerfile are tracked as follow-ups (not included here).

## Known limitation

A hard process-kill (SIGKILL) can lose the last open session (the async append races the
exit). The unload-flush spec therefore drives the **graceful** `disablePlugin` path
(runs `onunload` → `dispose()` flush while the process stays alive), which is
deterministic.

**Settings detection** relies on an undocumented Obsidian DOM contract
(`WindowActivityMonitor.SETTINGS_MODAL_SELECTOR`, verified on 1.12.7): `switchToSettings.e2e.ts`
is its guard — re-run it on every Obsidian bump.

**Window blur is synthetic** (`ObsidianHarness.blurWindow`/`focusWindow`): headless Obsidian
has no real OS focus switch — Electron's `BrowserWindow.blur()` neither fires the DOM `blur`
nor flips `document.hasFocus()` there. `windowBlur.e2e.ts` proves the plugin's wiring inside
real Obsidian, not the OS signal.
