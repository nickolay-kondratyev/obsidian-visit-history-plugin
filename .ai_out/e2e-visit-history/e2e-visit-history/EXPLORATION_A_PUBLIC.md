# EXPLORATION_A_PUBLIC — Visit History V3 recording (for e2e)

## 0. Plugin identity & enablement
- Plugin id `visit-history` (`manifest.json:2`), `isDesktopOnly:false`, minAppVersion 1.5.7.
- Entry `VisitHistoryPlugin extends Plugin` (`src/main.ts:14`).
- NO custom `window.app` hook. Reach internals via `app.plugins.plugins['visit-history']` (exposes `settings`, private `factory`). **Prefer asserting on-disk files, not internals.**
- Tracked (`src/Constants.ts:1-2`): view types `{markdown,canvas,excalidraw}`, extensions `{md,canvas,excalidraw}`. Raw `.excalidraw` gets NO doc-id → only `md` + `canvas` produce `.vh_v3` records.

## 1. Focus → session lifecycle
### Wiring (`PluginFactory.ts`)
- ctor wires name-independent parts: `FocusTracker` (`:97`), `DocIdFocusListener` registered FIRST (`:102`).
- `activateUserScopedRecording(userName)` (`:120-147`, only AFTER user name pinned): wires `VhV3DurationRecorder` (sink) → `FocusDurationTracker` with idle provider `() => plugin.settings.idleTimeoutSeconds*1000` (`:135`, LIVE read), `WindowActivityMonitor` (`:138`), `VhV3FocusDurationListener` (2nd listener `:139-140`), then `focusTracker.replayLastFocusTo(durationListener)` (`:144`).

### FocusTracker (`src/core/focusTracker/FocusTracker.ts`)
- Subscribes workspace `active-leaf-change` (`:67`), SERIALIZED on `dispatchChain`.
- `handleLeafChange` (`:113-133`): dispatches `onUnfocus` when focused FILE PATH changes, then `onFocus`. Tracked by FILE, not leaf.
- `FocusEvent` carries `ownerDocument` (per-window identity). `whenIdle()` returns dispatchChain (sync point).

### VhV3FocusDurationListener
- `onFocus`: `ensureDocId(file)`; if null/unsafe → `tracker.onDocUnfocused()`, else `tracker.onDocFocused(docId, ownerDocument)`.
- `onUnfocus`: `tracker.onDocUnfocused()`.

### FocusDurationTracker (state machine, `src/core/focusDuration/FocusDurationTracker.ts`)
Emits exactly one `sink.recordFocusDuration(docId,startMs,durationMs)` per close.
- `UNFOCUS_GRACE_MS = 10_000` (`:21`, FIXED, no setting). Unfocus → pending-close; same-doc refocus within 10s cancels; close stamped at ORIGINAL unfocus moment (grace never inflates duration).
- Close triggers: (1) nav to different/untracked doc → after 10s grace; (2) hosting window OS blur → immediate; (3) idle timeout → duration ends at `lastActivityMs` (idle tail not counted, retroactive sleep cap); (4) `dispose()` on unload → best-effort flush (async append may be lost on hard quit).

### WindowActivityMonitor
- Per-window (main + popouts): `blur/focus/visibilitychange`. Activity events `keydown,mousedown,mousemove,wheel,touchstart,touchmove` → `onUserActivity()` resets idle.

## 2. On-disk data
### Path (`VhV3Paths.ts` + `VhUserPaths.ts`)
```
__visit_history/user/<user-name>/v3/focus_duration_per_device/<device-name>/<doc-id>.vh_v3
```
- `TOP_DIR='__visit_history'`, `USERS_DIR='__visit_history/user'`. VISIBLE folder (not dot-hidden); excluded from tracking by `IsTrackedProvider.isVisitHistoryPath`.
- Also: `__visit_history/user/<user>/v3/README__generated__vh_v3_format.md`.

### Line format (`VhV3DurationStore.ts:51`, parser `VhV3SessionLineParser.ts:15`)
```
<ISO-8601 UTC ms stamp> D:<durationMillis>\n     e.g. 2026-07-09T22:02:15.745Z D:5600
```
- ISO stamp = focus START; `D:` = duration ms. Parser regex `^(\S+) D:(\d+)$`.

### Doc-id (submodules/obsidian-id-lib)
- md → frontmatter `id:` (`FrontmatterDocIdStore`); canvas → `metadata.frontmatter.id` (`CanvasDocIdStore`); raw `.excalidraw` → null.
- Generated: `docid_<24 base36>_e`. Existing ids honored as-is. Must pass `DocIdFilenameSafety.isFilenameSafeId`.
- **e2e tip:** pre-seed test note frontmatter `id:` / canvas `metadata.frontmatter.id` → known `.vh_v3` filename.

### Device name (`DeviceNameProvider.ts`)
- localStorage key **`obsidian-device-name`**; else desktop `os.hostname()`; else `mobile-<rand>`. **e2e: set `localStorage['obsidian-device-name']='e2e_device'`.**

### User name pinning + modal
- localStorage key **`obsidian-vh-user-name`** (device-scoped raw localStorage). If present → returned silently (NO modal). Else lists `__visit_history/user` dirs + opens modal on `onLayoutReady`.
- **e2e bypass (recommended):** set `localStorage['obsidian-vh-user-name']='e2e_user'` BEFORE onLayoutReady → modal skipped, recording activates. Must be lowercase filename-safe `a-z0-9._-`.

## 3. Idle timeout setting (`src/settings.ts`)
- `idleTimeoutSeconds`, default 180, min 5 (whole int). LIVE-read (no reload).
- Persisted in `.obsidian/plugins/visit-history/data.json` via loadData/saveData; sanitized on load (invalid → 180).
- **e2e set to 5:** write `data.json` `{"idleTimeoutSeconds":5}` before launch (≥5 or sanitized back), OR runtime via Settings → Visit History → "Idle timeout (seconds)". Floor 5s; idle path has NO 10s grace.

## 4. Lifecycle
- `onload` (`main.ts:24-62`): load settings → top-dir migration → build PluginFactory → register view+settings tab → defer user-name pin to `onLayoutReady`.
- `onunload`: `factory.dispose()` → flush open session (async, may lose last on hard quit); closes open modal.

## 5. Deterministic e2e observation
Setup before/at load:
1. Install built plugin into `<vault>/.obsidian/plugins/visit-history/`.
2. localStorage: `obsidian-vh-user-name='e2e_user'`, `obsidian-device-name='e2e_device'` → deterministic path + modal bypass.
3. Pre-seed doc-id in test note/canvas → known filename.
4. Optionally `data.json` `{"idleTimeoutSeconds":5}`.

Drive + observe (poll expected `.vh_v3` until content matches `/^\S+ D:\d+$/m`; allow ~15s for grace+append):
- **Switch focus A→B:** A closes after 10s grace → assert A's file has a line (~11s).
- **Close Obsidian / disable plugin:** `dispose()` flush → assert line (poll; hard-quit races async append — prefer plugin disable or poll).
- **Switch to Settings:** active leaf untracked → unfocus → 10s grace close.
- **Focus in canvas:** open seeded `.canvas`, interact, assert `<canvas-id>.vh_v3`.
- **Idle:** `idleTimeoutSeconds=5`, focus doc, no input >5s → idle close at last activity (~6s wait, no grace).

Timing: writes serialized through `VhV3DurationRecorder.writeChain`; `HiddenFileUtilDefault.append` creates dirs+file; `LastVisitCache` in-memory only (irrelevant to disk assert). NO synchronous DOM-reachable flush hook → use polling with timeout.

Key files: FocusTracker, FocusDurationTracker, WindowActivityMonitor, VhV3FocusDurationListener, VhV3DurationRecorder, VhV3DurationStore, VhV3Paths, VhUserPaths, UserNameProvider, ModalUserNamePrompt, DeviceNameProvider, settings.ts, VisitHistorySettingTab, Constants.ts, main.ts, PluginFactory.ts; obsidian-id-lib {DocIdService,FrontmatterDocIdStore,CanvasDocIdStore,DocIdGenerator}. Ref: `docs/visit-history-format.md`.
