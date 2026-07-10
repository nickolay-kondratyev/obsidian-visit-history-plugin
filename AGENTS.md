# Visit History Plugin

Records visit history of notes, canvases, and Excalidraw drawings. When you focus a file, a timestamp is appended to a per-document, per-device visit history log under `.visit_history/` (keyed by the file's persistent doc id, assigned on focus if missing). V3 additionally records the DURATION of each focus session alongside V2 (V2 stays the main history). Legacy `_visit_history/` (V1) data is auto-migrated to V2 on load. Also provides a treemap heatmap visualization of vault file activity.

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
  main.ts                  # Plugin lifecycle (onload, onunload, register views/commands)
  settings.ts              # Persisted settings: idleTimeoutSeconds (default 180, min 5);
                           # SettingsSanitizer validates loadData() at the boundary
  Constants.ts             # Tracked view types, file extensions, top-level dir names

  core/
    init/
      PluginFactory.ts     # DI container — constructs and wires all dependencies
      VhStartupTasks.ts    # Deferred load work (onLayoutReady): V2+V3 README writes + V1→V2 migration
    focusTracker/
      FocusTracker.ts      # Listens to Obsidian active-leaf-change; dispatches to
                           # FocusListeners (dispatch SERIALIZED — in-order delivery;
                           # tracks focused FILE, not leaf — unfocus fires on any
                           # file change, incl. same-leaf nav to untracked views)
      listener/
        DocIdFocusListener.ts                # On focus → ensures doc id (registered first)
        VisitHistoryFocusListenerDefault.ts  # On focus → records V2 visit
        VhV3FocusDurationListener.ts         # Focus/unfocus → V3 duration sessions
    focusDuration/
      FocusDurationTracker.ts   # V3 session state machine (per-window doc focus,
                                # configurable idle timeout — live-read from settings)
      VhV3DurationRecorder.ts   # FocusDurationSink → V3 store (one serialized write chain)
      WindowActivityMonitor.ts  # DOM boundary, per Obsidian window (main + popouts):
                                # blur/focus, visibility, input events
    service/
      visitHistoryService/  # VisitHistoryService interface;
                            # DocIdFilenameSafety (shared V2+V3 id-as-filename check)
        v2/                 # VisitHistoryServiceV2 (record/last-visit via doc id),
                            # VhV2FocusStore (owns .vh_v2 format), VhV2Paths (layout),
                            # VhV2ReadmeWriter
        v3/                 # VhV3DurationStore (owns .vh_v3 duration format),
                            # VhV3Paths (layout), VhV3ReadmeWriter
      docId/                # DocIdService (dispatch by extension; ensureDocId +
                            # read-only getDocId), DocIdGenerator
                            # (docid_{21 base62}_E), FrontmatterDocIdStore (md),
                            # CanvasDocIdStore (canvas JSON), DocIdBackfillService
                            # (vault-wide backfill; concurrent calls JOIN)
      migration/            # VhV1ToV2MigrationService, V1FocusFileRepo (legacy
                            # _visit_history tree), V1FocusFileParser (V1 content)
    data/                   # FileTimeMetadata, VaultNode (heatmap tree node)
    util/                   # vault/ (VaultUtil, IsTrackedProvider),
                            # file/note/ (NoteFileUtil — vault file I/O),
                            # file/hidden/ (HiddenFileUtil — DataAdapter I/O for
                            # dot-folders the Vault API can't see),
                            # time/ (StampLineParser — strict stamp-line parsing),
                            # async/ (InFlightDropGuard — per-key dedup, DROP semantics),
                            # env/ (DeviceNameProvider), userComm/ (UserNotifier),
                            # linkUtil/ (wiki-link target resolution)

  settingsTab/              # VisitHistorySettingTab (Settings → Visit History):
                            # "Idle timeout (seconds)" (persisted, applies live) +
                            # "File modifying actions" (doc id backfill) behind a
                            # ConfirmModal

  testSupport/              # Test-only fakes + runtime stand-in for 'obsidian'
                            # (the npm package is types-only; see vitest.config.ts)

  view/                     # React UI (Obsidian-agnostic except VaultTreemapView)
    VaultTreemapView.tsx    # Obsidian ItemView boundary — mounts React, handles vault events
    components/             # App (config state owner), TreemapViz (SVG treemap + zoom),
                            # Header, ConfigPanel/, FolderNode, LeafNode, Tooltip, Legend
    constants.ts, utils.ts  # Palettes + HeatField/GradientKey unions; pure color/format helpers

  viewModel/
    buildVaultTree.ts       # TrackedFile[] → VaultNode tree (single vault walk)
    pruneArchiveFolders.ts  # Hides _archive folders below the heatmap view root
                            # (scope into an archive via its folder context menu)
    FileOpener.ts           # IFileOpener interface + ObsidianFileOpener impl
```

### Key design decisions

- **PluginFactory** is the DI container. `main.ts` calls it once. All dependencies are constructor-injected — no service locators, no global state.
- **`_archive` folders are hidden in the heatmap** below the current view root: `pruneArchiveFolders` (applied in `TreemapViz` before layout) drops them plus folders they leave empty. Viewing an archive = scoping into it (folder context menu → "Open heatmap for folder"); backing out hides it again. When the view root is at/under an `_archive` (`isWithinArchive` on the nav stack), pruning is skipped — nested archives stay visible (an archive moved under another archive must not lose visibility — owner decision).
- **VaultTreemapView** is the **only file** in `view/` that imports from `obsidian`. All React components are Obsidian-agnostic and receive data/callbacks as props.
- **VH V2 files** live under `.visit_history/v2/focus_per_device/<device>/<doc-id>.vh_v2` — one ISO 8601 UTC ms stamp per line, sorted, deduped, newline-terminated. The doc id IS the filename (survives renames; no backlink indirection). `.visit_history` is a dot-folder — invisible to the Vault API/metadata cache — so ALL access goes through `HiddenFileUtil` (DataAdapter). Ids that are not filename-safe (`DocIdFilenameSafety.isFilenameSafeId`) are skipped with `console.error`.
- **VH V3 (focus durations)** is recorded ALONGSIDE V2 under `.visit_history/v3/focus_duration_per_device/<device>/<doc-id>.vh_v3` — one completed session per line: `<ISO start stamp> D:<millis>`. `FocusDurationTracker` closes a session on navigation away, blur of the window HOSTING the doc, idle timeout (setting `idleTimeoutSeconds`, default 180 s, min 5 s, live-read — no reload needed; duration then ends at the LAST interaction — owner decision; also enforced retroactively so OS sleep is never counted; interaction after idle starts a NEW session), or unload flush (hard app quit can lose the last open session — accepted). Writes go through `VhV3DurationRecorder`'s single serialized chain.
- **Popout windows are first-class for V3**: `WindowActivityMonitor` registers on every window (main + `window-open`/`window-close`; popouts already open at plugin load are discovered via leaf enumeration — their `window-open` fired before we loaded); a window's `Document` object is its identity handle (`WindowHandle`), also carried by `FocusEvent.ownerDocument` from the leaf's `containerEl`. Switching popout→popout closes the left-behind doc's session; a tab dragged to a new window keeps its session.
- **FocusTracker dispatch is SERIALIZED** (promise chain): listeners await file IO, so rapid leaf-change events would otherwise interleave and deliver focus/unfocus out of order — stateful listeners (V3 durations) require in-order delivery.
- **V1 → V2 auto migration** (`VhV1ToV2MigrationService`, from `VhStartupTasks` on layout-ready): doc id backfill → parse V1 files → merge per (device, doc id) into V2 → validate readback → only then PERMANENTLY delete `_visit_history/` (unmigratable files included — owner decision); any validation failure deletes nothing.
- **Visit deduplication**: focus listeners use `InFlightDropGuard` (`core/util/async/`) — in-flight promise tracking with DROP semantics — to avoid duplicate writes on rapid focus events. `VisitHistoryServiceV2` additionally skips consecutive records to the same doc id — intentionally NOT time-window based, so A→B→A navigation pathways stay fully recorded (owner decision).
- **Doc ids**: every focused document gets a persistent id `docid_{21 base62}_E`. md (incl. `.excalidraw.md`) → frontmatter `id`; canvas → `metadata.frontmatter.id`; raw `.excalidraw` skipped (no id location — owner decision). An existing id — any format — is used as-is and the file is NOT modified; an unusable occupied id slot (e.g. nested mapping) is never overwritten. Writes are atomic raw-text edits via `Vault.process` that only add/fill the id line — Obsidian's `FileManager.processFrontMatter` is deliberately NOT used (it re-serializes the whole frontmatter block, mangling formatting of keys we don't own, e.g. stripping quotes). Vault-wide backfill (settings tab) reuses the same `ensureDocId` path per file.
- **LRU caching** (instance fields, never module-level): `VisitHistoryServiceV2` caches last-visit stamps (10k entries); write-through on record, invalidated after migration. Heatmap reads resolve ids via the READ-ONLY `DocIdService.getDocId` — bulk read paths must never write into user files.
- **Malformed files never throw**: stamp parsing (`StampLineParser` / `VhV2FocusStore` / `V1FocusFileParser`) skips bad lines and `CanvasDocIdStore` returns `null` for unparseable content, so one bad file can't break aggregation, migration, or focus handling.
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
- **Mock only at system boundaries** (Obsidian APIs). Reusable fakes in `src/testSupport/`: `FakeNoteFileUtil`, `FakeFrontmatterUtil`, `FakeLinkUtil`, `makeTFile`, … Test behavior, not implementation.
- **Known untested seam**: `PluginFactory` wiring (incl. listener registration order — doc id before visit recording) needs a full App mock; keep wiring trivial instead.

## Obsidian plugin conventions

- **Lifecycle**: `registerEvent()`/`registerDomEvent()`/`registerInterval()` for all cleanup; lightweight `onload()` (lazy init); `onunload()` releases everything (React roots, intervals, listeners).
- **Commands & settings**: stable command IDs (never rename after release); persist via `loadData()`/`saveData()`; sentence case for UI text.
- **Security**: fully offline/local — no network calls, no telemetry; reads/writes stay within the vault.
- **Releases**: bump `manifest.json` version (SemVer) + `versions.json` mapping; GitHub release tag = version (no `v` prefix); attach `main.js`, `manifest.json`, `styles.css`.

## Build & file conventions

- Source in `src/`; output at plugin root (`main.js`, `main.js.map`).
- **Never commit** `node_modules/`, `main.js`, or build artifacts.
- Files >200-300 lines → consider splitting. Keep the plugin small; avoid large dependencies.
