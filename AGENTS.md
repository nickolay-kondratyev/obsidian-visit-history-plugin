# Visit History Plugin

Records visit history of notes, canvases, and Excalidraw drawings. Each completed focus session (start timestamp + duration) is appended to a per-user, per-document, per-device V3 log under `.plugin_data/visit_history/user/<user-name>/` (keyed by the file's persistent doc id, assigned on focus if missing; dot-hidden so Obsidian's file explorer/search never surface it — Obsidian Sync also skips dot-folders, so history is per-device and does NOT sync — accepted owner decision). Legacy v2 and `_visit_history/` (V1) data from older plugin versions is no longer read or written — content left untouched (owner decision); a pre-2026-07 `.visit_history/` dir is auto-renamed to the interim visible `__visit_history/`, its live `.vh_v3`+README files then moved under `.plugin_data/visit_history/`, and the pre-user-scoped `v2|v3` layout is auto-moved under `user/<user-name>/`. Still-visible legacy leftovers (`__visit_history/`, `_visit_history/`) are excluded from tracking/heatmap by `IsTrackedProvider`. Also provides a treemap heatmap visualization of vault file activity, and an "Inline note (visit history aware)" action that merges a singly-linked note (content + history) into the note linking it.

## Project overview

- Obsidian Community Plugin: TypeScript → esbuild → `main.js`
- Release artifacts: `main.js`, `manifest.json`, `styles.css`
- Entry point: `src/main.ts` (Obsidian Plugin subclass)

## Dev environment

```bash
npm install        # install dependencies
npm run dev        # watch mode
npm run build      # production build (tsc + esbuild)
npm run lint       # ESLint (eslint-plugin-obsidianmd `recommended`) — kept at ZERO
                   # errors. This config IS Obsidian's publish-time validation, so
                   # keep the plugin on the LATEST version to catch publish errors
                   # locally (new versions add rules; publish uses latest).
npm test           # vitest unit tests
npm run test:e2e   # real-Obsidian Playwright e2e (auto-downloads pinned Obsidian,
                   # headless; asserts on-disk .vh_v3 — see docs/e2e-testing.md)
npm run version    # bump version + update manifest/versions
npm run android:setup        # manual Android tablet testing: emulator + Obsidian + dev vault
npm run android:push-plugin  # rebuild + push plugin to the tablet, restart Obsidian
                             # (both: scripts/android/, docs/android-tablet-testing.md)
```

- Node 18+, npm, esbuild bundler
- `build.sh` — one-shot local dev bootstrap (npm install → `npm run dev`;
  needs the glassthought bash env). For live iteration, install a hot-reload plugin in the
  Obsidian vault this plugin is enabled in so rebuilt `main.js` reloads without restarting Obsidian.
- `tsconfig.json`: strict, ES2021, React JSX (`react-jsx`)
- Dependencies: React 18, d3-hierarchy, d3-color, d3-interpolate, visx/zoom, stable-ids-for-obsidian (published npm package — its own repo at github.com/nickolay-kondratyev/obsidian-id-lib; bundle changes there, publish, then bump the version here)

High-level docs live in [`docs/`](docs/README.md): architecture, VH on-disk
format, heatmap view, e2e testing, Android tablet testing.

## Architecture

```
src/
  main.ts                  # Plugin lifecycle (onload, onunload, register views/commands);
                           # onload runs the top-dir rename FIRST, then wires PluginFactory
                           # (name-independent parts only); user-name pin (modal) +
                           # user-scope layout move + recording activation on onLayoutReady
  settings.ts              # Persisted settings: idleTimeoutSeconds (default 180, min 5),
                           # minFocusSecondsToRecord (default 2, min 0; 0 disables)
                           # + heatmap (HeatmapConfig — sticky heatmap view config);
                           # SettingsSanitizer validates loadData() at the boundary
  Constants.ts             # Tracked view types, file extensions, top-level dir names

  core/
    config/
      ConfigProvider.ts    # EFFECTIVE runtime config seam (getIdleTimeoutMs) —
                           # dev override wins over the live setting, NO floor re-clamp
      DevConfigOverridesReader.ts  # parses the dev overrides JSON once (empty on any failure)
      DevOverridesFileSource.ts    # env-gated desktop-only fs read of the overrides file
                           # (__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__); inert in prod
    init/
      PluginFactory.ts     # DI container — ctor wires name-independent deps;
                           # activateUserScopedRecording(userName) wires recording post-pin
      VhStartupTasks.ts    # Deferred post-pin work: V3 README write
    focusTracker/
      FocusTracker.ts      # Listens to Obsidian active-leaf-change; dispatches to
                           # FocusListeners (dispatch SERIALIZED — in-order delivery;
                           # tracks focused FILE, not leaf — unfocus fires on any
                           # file change, incl. same-leaf nav to untracked views;
                           # syncWithActiveLeaf() once on layout ready → a doc
                           # already open at plugin enable is tracked)
      listener/
        DocIdFocusListener.ts                # On focus → ensures doc id (registered first)
        VhV3FocusDurationListener.ts         # Focus/unfocus → V3 duration sessions
    focusDuration/
      FocusDurationTracker.ts   # V3 session state machine (per-window doc focus,
                                # configurable idle timeout — live-read from settings)
      VhV3DurationRecorder.ts   # FocusDurationSink → V3 store (one serialized write
                                # chain) + VisitStatsCache write-through
      MinDurationFilteringSink.ts # FocusDurationSink decorator: drops sessions
                                # shorter than the min-focus setting BEFORE the
                                # recorder (no trace at all); threshold live-read
      WindowActivityMonitor.ts  # DOM boundary, per Obsidian window (main + popouts):
                                # blur/focus, visibility, input events, Settings
                                # modal open/close (body childList observer on an
                                # undocumented DOM selector — counts as blur/refocus)
      FocusSessionReleaser.ts   # Seam: close + flush a doc's session before its
                                # history files move (impl inline in PluginFactory)
    service/
      visitHistoryService/  # VisitStatsProvider (read-only per-note stats interface),
                            # VisitStats (last visit + total focus; owns the fold);
                            # DocIdFilenameSafety (id-as-filename check)
        user/               # VhUserPaths (.plugin_data/visit_history/user/<user-name>/ level),
                            # UserNameProvider (prompts + pins the user name),
                            # UserNameSafety (lowercase charset), UserNamePrompt
                            # (+ ModalUserNamePrompt — thin Obsidian modal)
        v3/                 # VisitHistoryServiceV3 (visit stats via doc id),
                            # VhV3DurationStore (owns .vh_v3 duration format;
                            # append + read), VhV3SessionLineParser (line grammar),
                            # VisitStatsCache (LRU, race-safe read/write-through),
                            # VhV3Paths (layout), VhV3ReadmeWriter,
                            # VhV3HistoryMerger (moves an inlined note's files
                            # under merged_in_focus_duration_per_device/)
      inlineNote/           # "Inline note (visit history aware)": InlineNoteAction
                            # (orchestrator) ← InlineNotePlanner (read-only checks);
                            # pure rules: NoteReferenceCollector + CanvasReferenceScanner
                            # (link census), InlineEligibility, InlineRefusals (all
                            # user-facing texts), InlinedNoteParser, FrontmatterMerger,
                            # MarkdownSectionPlacer; impl/ModalInlineNoteDialogs
      docId/                # DocIdBackfillService only (vault-wide backfill;
                            # concurrent calls JOIN). Generator/stores/service/
                            # cross-plugin lock live in the stable-ids-for-obsidian
                            # npm package (its own repo)
      migration/            # VhTopDirRenameMigrationService (.visit_history →
                            # __visit_history; runs FIRST in onload) +
                            # VhPluginDataMoveMigrationService (__visit_history →
                            # .plugin_data/visit_history; runs SECOND, moves live
                            # .vh_v3+README only) + VhUserScopeMigrationService
                            # (pre-user-scoped v2/v3 → user/<user-name>/); cleanup
                            # rename+user-scope after 2026-October, move after 2027-February
    data/                   # FileTimeMetadata, VaultNode (heatmap tree node)
    util/                   # cache/ (LruCache — self-written bounded LRU;
                            # replaced the lru-cache npm dep, whose fetch()
                            # methods false-positived the scorecard's
                            # network-call check),
                            # vault/ (VaultUtil, IsTrackedProvider),
                            # file/note/ (NoteFileUtil — vault file I/O),
                            # file/hidden/ (HiddenFileUtil — DataAdapter I/O for
                            # all VH data paths, incl. legacy dot-dirs the
                            # Vault API can't see),
                            # time/ (StampLineParser — strict ISO stamp parsing),
                            # async/ (InFlightDropGuard — per-key dedup, DROP semantics),
                            # env/ (DeviceNameProvider, DesktopOsInfo — typed
                            # mobile-safe desktop-only Node 'os' accessor;
                            # DesktopNodeModule — shared Platform-guarded typed
                            # require of desktop-only Node builtins, used by
                            # DesktopOsInfo + DevOverridesFileSource),
                            # userComm/ (UserNotifier)

  settingsTab/              # VisitHistorySettingTab (Settings → Visit History):
                            # "Idle timeout (seconds)" (persisted, applies live) +
                            # "File modifying actions" (doc id backfill) behind a
                            # ConfirmModal

  editorChrome/
    embedInlineIcon/        # Inline-note icon on a note embed (editor chrome, NOT view/):
                            # EmbedInlineIconRule (pure show/hide decision),
                            # EmbedInlineIconDecorator (single idempotent DOM write path),
                            # ReadingViewEmbedIconProcessor (post-processor) +
                            # LivePreviewEmbedIconExtension (CM6 ViewPlugin)

  testSupport/              # Test-only fakes + runtime stand-in for 'obsidian'
                            # (the npm package is types-only; see vitest.config.ts)

  view/                     # React UI (Obsidian-agnostic except VaultTreemapView)
    VaultTreemapView.tsx    # Obsidian ItemView boundary — mounts React, handles vault events
    VaultRootHeatmapFinder.ts  # Pure (obsidian-free) selector: first vault-level
                            # leaf at vault root, for the dedupe-reveal guard
    components/             # App (config + nav + filter state owner), TreemapViz
                            # (SVG treemap + zoom, filter empty-state w/ clear-
                            # filters CTA; zoom reset bridged to Header via ref),
                            # Header (actions-only incl. zoom reset), header/
                            # (FilterGroup chips, FilterPopover, FieldPopover,
                            # InfoPopover),
                            # ConfigPanel/ (SegmentedToggle switch, RadioGroup,
                            # RangeSlider w/ editable bounds), icons.tsx (one
                            # lucide-style stroked-SVG family, currentColor),
                            # FolderNode, LeafNode, CollapsedFolderNode, TileLabelText
                            # (scale(1/zoom) tile labels), Tooltip, Legend
    constants.ts, utils.ts  # Palettes + ColorMode/HeatField/GradientKey unions; pure helpers

  viewModel/
    buildVaultTree.ts       # TrackedFile[] → VaultNode tree (single vault walk)
    pruneArchiveFolders.ts  # Hides _archive folders below the heatmap view root
                            # (scope into an archive via its folder context menu)
    partitionTreemapNodes.ts # Laid-out treemap → folders / collapsed dense folders / leaves
    label/                  # Tile label fitting (pure): LabelLineFitter (measured-width
                            # wrap + "…"), TileLabelLayout (zoom-aware show/place),
                            # CharWidthMeasurer (+ per-char cache); DOM font read in
                            # view/label/CanvasLabelFontProbe
    tileSize.ts             # Pure tile sizing (TileSizing: mode + curve + type scales;
                            # tileValue, hideUnvisitedFiles for visit-time mode)
    heatmapConfig.ts        # HeatmapConfig model (BoundedValue = value + editable slider
                            # min/max; FilterTerm path|content include-terms)
                            # + HeatmapConfigSanitizer (data.json boundary)
    filterVaultTree.ts      # Pure include-filter over the VaultNode tree
                            # (OR across terms; mirrors pruneArchiveFolders)
    FilterTermOps.ts        # FilterTerm add/remove/query (trim + per-kind ci-dedupe)
    ContentTermMatcher.ts   # ContentTermMatcher interface + Default impl (content
                            # substring search via VaultUtil.getTrackedTFiles +
                            # cachedRead; wired in PluginFactory → App prop)
    HeatmapConfigStore.ts   # HeatmapConfigStore interface + PluginHeatmapConfigStore
                            # (debounced saveData; flush on unload)
    FileOpener.ts           # IFileOpener interface + ObsidianFileOpener impl
```

### Key design decisions

- **PluginFactory** is the DI container. `main.ts` calls it once. All dependencies are constructor-injected — no service locators, no global state.
- **`_archive` folders are hidden in the heatmap** below the current view root: `pruneArchiveFolders` (applied in `TreemapViz` before layout) drops them plus folders they leave empty. Viewing an archive = scoping into it (folder context menu → "Open heatmap for folder"); backing out hides it again. When the view root is at/under an `_archive` (`isWithinArchive` on the derived trail), pruning is skipped — nested archives stay visible (an archive moved under another archive must not lose visibility — owner decision).
- **Dense folders collapse** (`partitionTreemapNodes`): a folder below the view root whose unzoomed rect averages < 32×32 px per file renders as ONE tile (name + file count, colored by its most recent file per the active field; click drills in) — bounds SVG node count. Zoom does not expand it (ceiling). Header stats/empty-state still count ALL laid-out files (incl. collapsed; not visit-time-hidden ones).
- **Heatmap labels** are fitted by MEASURED width (canvas, label font read from `styles.css`) against the tile's ON-SCREEN size, and drawn in a `scale(1/zoom)` group — constant on-screen font, zooming in reveals names; no `<foreignObject>` (iOS WebKit misplaces it under transforms). Details: `docs/heatmap-view.md` "Tile labels".
- **Heatmap sizing** (`tileSize.ts`): tile value = `curve(raw) × typeScale`, unrounded; raw = bytes (1-byte floor) or focus SECONDS (`VisitStats.totalFocusMs`). `HeatmapConfig.sizeBy` (`contentSize`|`visitTime`) + `sizing[mode]` = curve (`linear`|`sqrt`|`log`, default `sqrt` both — content was linear before) + per-type scales, saved SEPARATELY per mode (sanitizer still reads legacy top-level `scales` as content scales; cleanup after 2027-April). Visit-time mode leaves out never-visited files (after prune+filter; empty folders drop) and the header banner counts them for the current view.
- **Heatmap filtering** is include-only OR over `HeatmapConfig.filterTerms` (`path` = ci-substring of the FULL vault path; `content` = ci-substring of file content). Pure `filterVaultTree` composes AFTER archive pruning in TreemapViz, so stats/legend reflect the filtered view. Content terms resolve at the Obsidian boundary via `ContentTermMatcher` (PluginFactory → App prop); `App`'s latest-wins effect depends on the content-term set AND `data` (renames re-resolve; file edits accepted-stale). `undefined` matched-set = content filtering inactive; EMPTY set = terms matched nothing/scan pending. Terms persist like all heatmap config (sticky across restarts + drill-down).
- **Heatmap drill-down nav is PATH-based**: `App` stores only vault-relative `folderSegments`; trail/current root/breadcrumb derive from the canonical tree each render — clicked nodes are never stored (TreemapViz renders pruned/filtered COPIES; storing nodes would pin nav to stale copies). Header popovers (filter/field/info/config) share a single `openPanel` state — at most one open; ALL close on click-outside (pointerdown on the header chrome wrapper's `ownerDocument` — popout-safe); Esc dismissal still ticketed.
- **VaultTreemapView** is the **only file** in `view/` that imports from `obsidian`. All React components are Obsidian-agnostic and receive data/callbacks as props.
- **Vault-level open dedupes-then-reveals**: a command/ribbon `open-vault-heatmap` REVEALS an existing vault-level view that is CURRENTLY at vault root (silent `revealLeaf`, first-found on multiples) instead of duplicating; a drilled-in vault view or any folder-targeted open still opens fresh. `App` reports at-root via `onAtVaultRootChange` → `VaultTreemapView.isAtVaultRoot()`; pure obsidian-free `VaultRootHeatmapFinder` picks the leaf.
- **Heatmap view is theme-aware end-to-end**: chrome AND treemap canvas colors derive from Obsidian theme vars (`--vt-*` mapping in `styles.css`; folder chrome via `color-mix` depth tiers `d1..d4`; leaf labels white with dark halo via `paint-order: stroke`; `body.theme-light` swaps type fg tints). No hard-coded dark-only colors in view components — node styling lives in CSS classes, inline styles only for per-node computed fills.
- **Heatmap config is sticky**: `App` owns a single `HeatmapConfig` and writes every change through `HeatmapConfigStore` into `settings.heatmap` (data.json) — saves debounced (slider drags), flushed on unload, sanitized on load. Every slider is a `BoundedValue`: its min/max bounds are user-editable and persist too.
- **VH V3 (focus durations)** is the only history read/written, under `.plugin_data/visit_history/user/<user>/v3/focus_duration_per_device/<device>/<doc-id>.vh_v3` — one completed session per line: `<ISO start stamp> D:<millis>`. The doc id IS the filename (survives renames; no backlink indirection). The top dir is deliberately dot-hidden under `.plugin_data/` — Obsidian's file explorer/search never surface it and plugins reacting to visible-folder creation are not disturbed; the trade-off (accepted) is that Obsidian Sync skips dot-folders so history is per-device and does NOT sync (a reversal of the earlier visible-`__visit_history` stance — see the issue URL at `VhUserPaths.TOP_DIR`). Because the Vault API never yields files under a dot-folder, the active dir needs no `IsTrackedProvider` gate; that gate excludes the still-visible legacy leftovers (`__visit_history/`, `_visit_history/`). ALL VH I/O goes through `HiddenFileUtil` (DataAdapter; reaches dot paths the Vault API can't). Ids that are not filename-safe (`DocIdFilenameSafety.isFilenameSafeId`) are skipped with `console.error`. `FocusDurationTracker` closes a session on navigation away (after a fixed 10 s unfocus grace — a same-doc refocus within grace continues the session so transient canvas-UI blips don't split it; the close is stamped at the ORIGINAL unfocus time, never inflating the duration), blur of the window HOSTING the doc (immediate, no grace; opening **Settings** in that window counts as a blur and closing it as a refocus → a NEW session — owner decision; Settings only, not other modals), idle timeout (setting `idleTimeoutSeconds`, default 180 s, min 5 s, live-read — no reload needed; duration then ends at the LAST interaction — owner decision; also enforced retroactively so OS sleep is never counted; interaction after idle starts a NEW session), or unload flush (hard app quit can lose the last open session — accepted). A **minimum focus time** gate (`MinDurationFilteringSink`, setting `minFocusSecondsToRecord`, default 2 s, min 0, live-read; 0 disables) drops any session shorter than the threshold BEFORE the recorder, so a quick in-and-out visit leaves NO trace at all — no `.vh_v3` line AND no `VisitStatsCache`/heatmap stats bump (owner decision; at the default, sub-2 s sessions incl. `D:0` pass-throughs are no longer recorded — a behavior change from older versions). Writes go through `VhV3DurationRecorder`'s single serialized chain.
- **Inline note (visit history aware)** (file menu on `.md` + command `inline-note`, started FROM note2): allowed only when the WHOLE vault holds exactly ONE whole-note link to note2 (body links, embeds, property links AND canvas cards/text — canvases scanned by us, metadataCache skips them; self-links ignored) in a plain `.md` note1; otherwise — or while any `.md` lacks a metadataCache entry (still indexing), or when the link sits in a heading line — a modal explains why (`InlineRefusals`); note2's links to itself are rewritten to same-note links (`SelfLinkRewriter`). Then confirm → re-plan → release+flush note2's session → atomic `Vault.process` on note1 (section placed after the link line / after its list-callout-table, headings shifted, `-continued` heading for loose text; frontmatter merged add-only raw-text, never `processFrontMatter`) → `ensureDocId(note1)` (after the edit: an id line would shift link offsets) → `VhV3HistoryMerger` MOVES note2's files (all local users/devices; chains flattened; `__N` suffix on collision) under `v3/merged_in_focus_duration_per_device/<device>/<note1-id>/`, which reads count towards note1 → `trashFile(note2)` LAST (any earlier failure keeps note2). Rules + decisions: tickets `nid_jlkies6u31pmfft2gu3qwom96_e`, `nid_g093hvhy7cn5bfyigkjhdp9w7_e`.
- **Embed inline icon** (`editorChrome/embedInlineIcon/`): a whole-note `![[note2]]` embed whose target is note2's ONLY link (per `metadataCache.resolvedLinks`, counted once and cached until the next `resolved`/`deleted` event — sync runs per DOM mutation, i.e. per keystroke; no canvas scan; canvas-only extra links show the icon and the click refuses — accepted ceiling) gets an icon beside Obsidian's native `.markdown-embed-link` (verified on 1.12.7; shown on embed hover, always on touch). Click = the SAME `InlineNoteAction.run` (no parallel rules). No icon on partial/non-`.md`/Excalidraw/nested/canvas embeds. Both modes sync from MutationObservers through one idempotent decorator; the CM6 plugin never lets a throw escape; all icons + observers are removed on unload. Ticket `nid_1pt4xcr428953lt5qgxbmiij7_e`.
- **User scoping** (`VhUserPaths`/`UserNameProvider`): all V3 data sits under `.plugin_data/visit_history/user/<user-name>/`, keeping histories of different people syncing one vault apart. The name is chosen by the human in a confirmation modal on `onLayoutReady` (unpinned devices only): pick an existing `user/<name>` dir (joining that identity) or type a new lowercase filename-safe name (`a-z0-9._-`, `UserNameSafety`; desktop pre-filled with the sanitized OS login name). Confirming pins it in device-scoped localStorage — FIRST PIN WINS, it never flips. Dismissing pins nothing: the plugin stays loaded (heatmap reads + doc-id assignment are name-independent) but NO VH is recorded until a name is pinned (re-prompted next start) — the V3 duration listener, user-scope migration, and README write all activate post-pin (`PluginFactory.activateUserScopedRecording`; activation REPLAYS the last focus event to the late-registered duration listener — serialized — so the doc already focused at startup/while the modal was up opens its session). Heatmap reads aggregate across ALL users (whole-vault activity — owner decision); writes go to the current user only. Two one-shot top-dir migrations run FIRST in `onload` — before the modal lists `.plugin_data/visit_history/user`: `VhTopDirRenameMigrationService` (`.visit_history/` → interim `__visit_history/`) then `VhPluginDataMoveMigrationService` (live `.vh_v3`+README `__visit_history/` → `.plugin_data/visit_history/`), each skipping + notifying on conflict; pre-user-scoped `v2|v3` dirs are then moved under the user by `VhUserScopeMigrationService` post-pin (all migrations never merge/delete; cleanup rename+user-scope after 2026-October, move after 2027-February).
- **Legacy VH data content is left untouched** (owner decision): v2 (wherever it sits — `.plugin_data/visit_history/user/<user>/v2/`, or stranded in the interim `__visit_history/v2/`) and `_visit_history/` (V1) are no longer read or written. The active dot-hidden `.plugin_data/visit_history/` needs no tracking gate; the still-visible legacy leftovers `__visit_history/` and `_visit_history/` are excluded from tracking/heatmap (`IsTrackedProvider`).
- **Heatmap "last visited"** = max V3 session START stamp across ALL users' devices (`VisitStatsProvider` ← `VisitHistoryServiceV3`, matching the old stamp-at-focus-time semantics). A visit becomes visible only once its session CLOSES — owner-accepted behavior change.
- **Popout windows are first-class for V3**: `WindowActivityMonitor` registers on every window (main + `window-open`/`window-close`; popouts already open at plugin load are discovered via leaf enumeration — their `window-open` fired before we loaded); a window's `Document` object is its identity handle (`WindowHandle`), also carried by `FocusEvent.ownerDocument` from the leaf's `containerEl`. Switching popout→popout closes the left-behind doc's session; a tab dragged to a new window keeps its session.
- **FocusTracker dispatch is SERIALIZED** (promise chain): listeners await file IO, so rapid leaf-change events would otherwise interleave and deliver focus/unfocus out of order — stateful listeners (V3 durations) require in-order delivery. On layout ready (before the post-pin replay) the tracker enqueues the already-active leaf's view (`syncWithActiveLeaf`, via `getActiveViewOfType(View)`), so a doc open at plugin enable/update/hot-reload — which gets no leaf-change — is tracked; a repeat of a startup leaf-change is a harmless duplicate focus.
- **Focus-event deduplication**: `DocIdFocusListener` uses `InFlightDropGuard` (`core/util/async/`) — in-flight promise tracking with DROP semantics — to avoid duplicate writes on rapid focus events.
- **Doc ids**: every focused document gets a persistent id `docid_{24 base36 lowercase}_e` (36^24 > 2^122 — above UUID v4 randomness). md (incl. `.excalidraw.md`) → frontmatter `id`; canvas → `metadata.frontmatter.id`; raw `.excalidraw` skipped (no id location — owner decision). An existing id — any format, incl. legacy uppercase base62 `docid_{21}_E` — is used as-is and the file is NOT modified; an unusable occupied id slot (e.g. nested mapping) is never overwritten. Writes are atomic raw-text edits via `Vault.process` that only add/fill the id line — Obsidian's `FileManager.processFrontMatter` is deliberately NOT used (it re-serializes the whole frontmatter block, mangling formatting of keys we don't own, e.g. stripping quotes). Vault-wide backfill (settings tab) reuses the same `ensureDocId` path per file.
- **Doc-id machinery is EXTRACTED to `stable-ids-for-obsidian`** (a published npm dependency with its own git repo; wired by `DocIdServices.createDefault(app.vault)` in PluginFactory). `ensureDocId` is guarded by the lib's `CrossPluginPathLock`: a per-path promise-chain registry on the versioned window/globalThis key `__obsidian_id_lib_path_lock_registry_v1__` (public cross-plugin contract — see the lib README), so two plugins bundling the lib serialize same-path id creation; `getDocId` stays lock-free. The in-transform re-check remains the idempotency backstop. Lib tests run in the lib's own repo.
- **LRU caching** (instance fields, never module-level; self-written `core/util/cache/LruCache` — no lru-cache dep, its `fetch()` methods false-positived the scorecard's network-call check): per-note visit stats (`VisitStats`: last visit + total focus time, ALL users/devices, closed sessions only) live in memory in `VisitStatsCache` (10k doc ids; no on-disk cache — derivable), read via `VisitStatsProvider.getVisitStats` (`VisitHistoryServiceV3`; caches misses incl. EMPTY) and kept current by `VhV3DurationRecorder` write-through. A write-seq protocol (not max-merge — a total can't be max-merged) keeps it race-safe: a disk read overlapping a session write is never cached; write-through never creates an entry; a failed append drops it. Heatmap reads resolve ids via the READ-ONLY `DocIdService.getDocId` — bulk read paths must never write into user files.
- **Malformed files never throw**: session parsing (`VhV3SessionLineParser` / `StampLineParser` / `VhV3DurationStore`) skips bad lines and `CanvasDocIdStore` returns `null` for unparseable content, so one bad file can't break aggregation or focus handling. Empty/whitespace-only canvas content is NOT malformed — it's a brand-new canvas, treated as `{}`, and gets an id on first focus.
- **Console logging**: only `console.error` for real failures (obsidianmd no-console rule); no debug logs.
- **Config seam (`ConfigProvider`)**: effective runtime config lives behind one interface — the idle closure in `PluginFactory` reads `configProvider.getIdleTimeoutMs()`, never `settings` directly. A DEV overrides JSON file (named by env var `__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__`, set ONLY by the e2e harness, read once via the desktop-guarded `DevOverridesFileSource`) can override values — bypassing hard limits like the min-5 s idle floor for e2e (`idleTimeoutOverride.e2e.ts`) — WITHOUT touching persisted settings/data.json. Inert in prod (no env var → live settings, byte-for-byte unchanged); mobile-safe (no override); only `idleTimeoutSeconds` is consumed today.

## Code rules

### TypeScript

- **Strict mode** (`"strict": true`). No implicit `any`. Use `noUncheckedIndexedAccess`.
- **Prefer interfaces** for public APIs; use `type` for unions and narrow helpers.
- **No `as` casts** except at system boundaries (e.g. Obsidian API gaps) — prefer type guards.
- **Explicit return types** on public methods. **`readonly`** on injected dependencies and set-once fields.
- **Avoid `null`** where `undefined` suffices; `null` only when it carries distinct meaning.
- **No enums** — string literal unions. **No default exports** except the Plugin class (`main.ts`).

### React

- **Functional components only**; hooks for state and effects.
- **Props drilling over context** — the app is small; context adds indirection without benefit.
- **State colocation**: nearest common ancestor owns state (`App.tsx` for config, `TreemapViz` for zoom).
- **No React.memo** unless profiling shows a specific render bottleneck.
- **One component per file** unless a sub-component is truly private and trivial (≤20 lines).
- **CSS via `styles.css`** at plugin root — keep style with style, not in JS.

### General OOP

- **SRP**: one reason to change per class; one thing per method.
- **DIP**: depend on interfaces; `PluginFactory` wires concretions (`*Default`) at construction.
- **OCP via composition**: new behavior = new interface implementation, not modification.
- **Self-contained classes** — no "manager"/"utility" sprawl. Stateless helpers OK in well-named static utility classes; no free-floating functions.

## Testing

- **Logical coverage over line coverage** — test the space of inputs, states, and edge cases (null/empty, duplicates, concurrency, boundaries), not just execution paths.
- **Tests are documentation**: GIVEN/WHEN/THEN, one assert per test where practical, `describe(Class) > describe(method) > it('should X when Y')`.
- **Every class with logic** gets a mirrored test file (`src/core/foo/Bar.ts` → `Bar.test.ts`). Bug fixes start with a failing test. Critical paths (visit recording, VH file management, doc id assignment, tree building) must be covered before refactoring.
- **Runner: vitest**; no Jest globals — explicit imports. The `obsidian` npm package is types-only; tests run against `src/testSupport/obsidianMock.ts` via the alias in `vitest.config.ts`.
- **Mock only at system boundaries** (Obsidian APIs). Reusable fakes in `src/testSupport/`: `FakeNoteFileUtil`, `FakeHiddenFileUtil`, `FakeDocIdService`, `makeTFile`, … Test behavior, not implementation.
- **Known untested seam**: `PluginFactory` wiring (incl. listener registration order — doc id before V3 duration tracking) needs a full App mock; keep wiring trivial instead.

## Obsidian plugin conventions

- **Lifecycle**: `registerEvent()`/`registerDomEvent()`/`registerInterval()` for all cleanup; lightweight `onload()` (lazy init); `onunload()` releases everything (React roots, intervals, listeners).
- **Commands & settings**: stable command IDs (never rename after release); persist via `loadData()`/`saveData()`; sentence case for UI text.
- **Security**: fully offline/local — no network calls, no telemetry; reads/writes stay within the vault.
- **Releases**: bump `manifest.json` version (SemVer) + `versions.json` mapping; GitHub release tag = version (no `v` prefix); attach `main.js`, `manifest.json`, `styles.css`.

## Build & file conventions

- Source in `src/`; output at plugin root (`main.js`, `main.js.map`).
- **Never commit** `node_modules/`, `main.js`, or build artifacts.
- Files >200-300 lines → consider splitting. Keep the plugin small; avoid large dependencies.
