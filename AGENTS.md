# Visit History Plugin

Records visit history of notes, canvases, and Excalidraw drawings. Each completed focus session (start timestamp + duration) is appended to a per-user, per-document, per-device V3 log under `.visit_history/user/<user-name>/` (keyed by the file's persistent doc id, assigned on focus if missing). Legacy v2 and `_visit_history/` (V1) data from older plugin versions is no longer read or written — content left untouched (owner decision); the pre-user-scoped `.visit_history/v2|v3` layout is auto-moved under `user/<user-name>/`. Also provides a treemap heatmap visualization of vault file activity.

## Project overview

- Obsidian Community Plugin: TypeScript → esbuild → `main.js`
- Release artifacts: `main.js`, `manifest.json`, `styles.css`
- Entry point: `src/main.ts` (Obsidian Plugin subclass)

## Dev environment

```bash
npm install        # install dependencies
npm run dev        # watch mode
npm run build      # production build (tsc + esbuild)
npm run lint       # ESLint (obsidianmd rules) — kept at ZERO errors
npm test           # vitest unit tests
npm run version    # bump version + update manifest/versions
```

- Node 18+, npm, esbuild bundler
- `tsconfig.json`: strict, ES2021, React JSX (`react-jsx`)
- Dependencies: React 18, d3-hierarchy, d3-color, d3-interpolate, visx/zoom, lru-cache, ulid

High-level docs live in [`docs/`](docs/README.md): architecture, VH on-disk
format, heatmap view.

## Architecture

```
src/
  main.ts                  # Plugin lifecycle (onload, onunload, register views/commands);
                           # onload resolves the user name + runs the user-scope layout move
                           # BEFORE wiring PluginFactory
  settings.ts              # Persisted settings: idleTimeoutSeconds (default 180, min 5)
                           # + heatmap (HeatmapConfig — sticky heatmap view config);
                           # SettingsSanitizer validates loadData() at the boundary
  Constants.ts             # Tracked view types, file extensions, top-level dir names

  core/
    init/
      PluginFactory.ts     # DI container — constructs and wires all dependencies
      VhStartupTasks.ts    # Deferred load work (onLayoutReady): V3 README write
    focusTracker/
      FocusTracker.ts      # Listens to Obsidian active-leaf-change; dispatches to
                           # FocusListeners (dispatch SERIALIZED — in-order delivery;
                           # tracks focused FILE, not leaf — unfocus fires on any
                           # file change, incl. same-leaf nav to untracked views)
      listener/
        DocIdFocusListener.ts                # On focus → ensures doc id (registered first)
        VhV3FocusDurationListener.ts         # Focus/unfocus → V3 duration sessions
    focusDuration/
      FocusDurationTracker.ts   # V3 session state machine (per-window doc focus,
                                # configurable idle timeout — live-read from settings)
      VhV3DurationRecorder.ts   # FocusDurationSink → V3 store (one serialized write
                                # chain) + LastVisitCache write-through
      WindowActivityMonitor.ts  # DOM boundary, per Obsidian window (main + popouts):
                                # blur/focus, visibility, input events
    service/
      visitHistoryService/  # LastVisitProvider (read-only last-visit interface);
                            # DocIdFilenameSafety (id-as-filename check)
        user/               # VhUserPaths (.visit_history/user/<user-name>/ level),
                            # UserNameProvider (resolves + persists the user name)
        v3/                 # VisitHistoryServiceV3 (last-visit via doc id),
                            # VhV3DurationStore (owns .vh_v3 duration format;
                            # append + read), VhV3SessionLineParser (line grammar),
                            # LastVisitCache (LRU, shared read/write-through),
                            # VhV3Paths (layout), VhV3ReadmeWriter
      docId/                # DocIdService (dispatch by extension; ensureDocId +
                            # read-only getDocId), DocIdGenerator
                            # (docid_{21 base62}_E), FrontmatterDocIdStore (md),
                            # CanvasDocIdStore (canvas JSON), DocIdBackfillService
                            # (vault-wide backfill; concurrent calls JOIN)
      migration/            # VhUserScopeMigrationService (pre-user-scoped v2/v3 →
                            # user/<user-name>/; cleanup after 2026-October)
    data/                   # FileTimeMetadata, VaultNode (heatmap tree node)
    util/                   # vault/ (VaultUtil, IsTrackedProvider),
                            # file/note/ (NoteFileUtil — vault file I/O),
                            # file/hidden/ (HiddenFileUtil — DataAdapter I/O for
                            # dot-folders the Vault API can't see),
                            # time/ (StampLineParser — strict ISO stamp parsing),
                            # async/ (InFlightDropGuard — per-key dedup, DROP semantics),
                            # env/ (DeviceNameProvider), userComm/ (UserNotifier)

  settingsTab/              # VisitHistorySettingTab (Settings → Visit History):
                            # "Idle timeout (seconds)" (persisted, applies live) +
                            # "File modifying actions" (doc id backfill) behind a
                            # ConfirmModal

  testSupport/              # Test-only fakes + runtime stand-in for 'obsidian'
                            # (the npm package is types-only; see vitest.config.ts)

  view/                     # React UI (Obsidian-agnostic except VaultTreemapView)
    VaultTreemapView.tsx    # Obsidian ItemView boundary — mounts React, handles vault events
    components/             # App (config + nav + filter state owner), TreemapViz
                            # (SVG treemap + zoom, filter empty-state),
                            # Header (actions-only), header/ (FilterGroup chips,
                            # FilterPopover, FieldPopover, InfoPopover),
                            # ConfigPanel/ (SegmentedToggle, RadioGroup,
                            # RangeSlider w/ editable bounds), FolderNode, LeafNode,
                            # Tooltip, Legend
    constants.ts, utils.ts  # Palettes + ColorMode/HeatField/GradientKey unions; pure helpers

  viewModel/
    buildVaultTree.ts       # TrackedFile[] → VaultNode tree (single vault walk)
    pruneArchiveFolders.ts  # Hides _archive folders below the heatmap view root
                            # (scope into an archive via its folder context menu)
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
- **Heatmap filtering** is include-only OR over `HeatmapConfig.filterTerms` (`path` = ci-substring of the FULL vault path; `content` = ci-substring of file content). Pure `filterVaultTree` composes AFTER archive pruning in TreemapViz, so stats/legend reflect the filtered view. Content terms resolve at the Obsidian boundary via `ContentTermMatcher` (PluginFactory → App prop); `App`'s latest-wins effect depends on the content-term set AND `data` (renames re-resolve; file edits accepted-stale). `undefined` matched-set = content filtering inactive; EMPTY set = terms matched nothing/scan pending. Terms persist like all heatmap config (sticky across restarts + drill-down).
- **Heatmap drill-down nav is PATH-based**: `App` stores only vault-relative `folderSegments`; trail/current root/breadcrumb derive from the canonical tree each render — clicked nodes are never stored (TreemapViz renders pruned/filtered COPIES; storing nodes would pin nav to stale copies). Header popovers (filter/field/info/config) share a single `openPanel` state — at most one open; no click-outside/Esc dismissal (consistent with ConfigPanel; ticketed).
- **VaultTreemapView** is the **only file** in `view/` that imports from `obsidian`. All React components are Obsidian-agnostic and receive data/callbacks as props.
- **Heatmap config is sticky**: `App` owns a single `HeatmapConfig` and writes every change through `HeatmapConfigStore` into `settings.heatmap` (data.json) — saves debounced (slider drags), flushed on unload, sanitized on load. Every slider is a `BoundedValue`: its min/max bounds are user-editable and persist too.
- **VH V3 (focus durations)** is the only history read/written, under `.visit_history/user/<user>/v3/focus_duration_per_device/<device>/<doc-id>.vh_v3` — one completed session per line: `<ISO start stamp> D:<millis>`. The doc id IS the filename (survives renames; no backlink indirection). `.visit_history` is a dot-folder — invisible to the Vault API/metadata cache — so ALL access goes through `HiddenFileUtil` (DataAdapter). Ids that are not filename-safe (`DocIdFilenameSafety.isFilenameSafeId`) are skipped with `console.error`. `FocusDurationTracker` closes a session on navigation away, blur of the window HOSTING the doc, idle timeout (setting `idleTimeoutSeconds`, default 180 s, min 5 s, live-read — no reload needed; duration then ends at the LAST interaction — owner decision; also enforced retroactively so OS sleep is never counted; interaction after idle starts a NEW session), or unload flush (hard app quit can lose the last open session — accepted). Writes go through `VhV3DurationRecorder`'s single serialized chain.
- **User scoping** (`VhUserPaths`/`UserNameProvider`): all V3 data sits under `.visit_history/user/<user-name>/`, keeping histories of different people syncing one vault apart. Name resolution (first resolution WINS, persisted in device-scoped localStorage so it never flips): desktop → OS account user name; mobile → the single existing `user/<name>` dir if exactly one, else persisted `mobile-user-<random8>` (no user-identity API on Obsidian mobile). Heatmap reads aggregate across ALL users (whole-vault activity — owner decision); writes go to the current user only. Pre-user-scoped `.visit_history/v2|v3` dirs are moved under the user by `VhUserScopeMigrationService` early in `onload` (never merges/deletes; cleanup after 2026-October).
- **Legacy VH data content is left untouched** (owner decision): v2 (wherever it sits — `.visit_history/v2/` or, after the layout move, `.visit_history/user/<user>/v2/`) and `_visit_history/` (V1) are no longer read or written. `_visit_history/` files stay excluded from tracking/heatmap (`IsTrackedProvider`).
- **Heatmap "last visited"** = max V3 session START stamp across ALL users' devices (`LastVisitProvider` ← `VisitHistoryServiceV3`, matching the old stamp-at-focus-time semantics). A visit becomes visible only once its session CLOSES — owner-accepted behavior change.
- **Popout windows are first-class for V3**: `WindowActivityMonitor` registers on every window (main + `window-open`/`window-close`; popouts already open at plugin load are discovered via leaf enumeration — their `window-open` fired before we loaded); a window's `Document` object is its identity handle (`WindowHandle`), also carried by `FocusEvent.ownerDocument` from the leaf's `containerEl`. Switching popout→popout closes the left-behind doc's session; a tab dragged to a new window keeps its session.
- **FocusTracker dispatch is SERIALIZED** (promise chain): listeners await file IO, so rapid leaf-change events would otherwise interleave and deliver focus/unfocus out of order — stateful listeners (V3 durations) require in-order delivery.
- **Focus-event deduplication**: `DocIdFocusListener` uses `InFlightDropGuard` (`core/util/async/`) — in-flight promise tracking with DROP semantics — to avoid duplicate writes on rapid focus events.
- **Doc ids**: every focused document gets a persistent id `docid_{21 base62}_E`. md (incl. `.excalidraw.md`) → frontmatter `id`; canvas → `metadata.frontmatter.id`; raw `.excalidraw` skipped (no id location — owner decision). An existing id — any format — is used as-is and the file is NOT modified; an unusable occupied id slot (e.g. nested mapping) is never overwritten. Writes are atomic raw-text edits via `Vault.process` that only add/fill the id line — Obsidian's `FileManager.processFrontMatter` is deliberately NOT used (it re-serializes the whole frontmatter block, mangling formatting of keys we don't own, e.g. stripping quotes). Vault-wide backfill (settings tab) reuses the same `ensureDocId` path per file.
- **LRU caching** (instance fields, never module-level): `LastVisitCache` holds last-visit stamps keyed by doc id (10k entries), shared by `VisitHistoryServiceV3` (read; caches misses incl. null) and `VhV3DurationRecorder` (write-through after each successful append; max-merge so a racing cache-miss read can't clobber it). Heatmap reads resolve ids via the READ-ONLY `DocIdService.getDocId` — bulk read paths must never write into user files.
- **Malformed files never throw**: session parsing (`VhV3SessionLineParser` / `StampLineParser` / `VhV3DurationStore`) skips bad lines and `CanvasDocIdStore` returns `null` for unparseable content, so one bad file can't break aggregation or focus handling. Empty/whitespace-only canvas content is NOT malformed — it's a brand-new canvas, treated as `{}`, and gets an id on first focus.
- **Console logging**: only `console.error` for real failures (obsidianmd no-console rule); no debug logs.

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
