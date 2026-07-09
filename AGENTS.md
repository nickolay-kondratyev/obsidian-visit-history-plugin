# Visit History Plugin

Records visit history of notes, canvases, and Excalidraw drawings. When you focus a file, a timestamp is appended to a per-file visit history log under `_visit_history/`, and the file is assigned a persistent doc id if it lacks one. Also provides a treemap heatmap visualization of vault file activity.

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
  settings.ts              # Settings interface + defaults (currently placeholder)
  Constants.ts             # Tracked view types, file extensions, top-level dir names

  core/
    init/
      PluginFactory.ts     # DI container — constructs and wires all dependencies
    focusTracker/
      FocusTracker.ts      # Listens to Obsidian active-leaf-change; dispatches to FocusListeners
      listener/
        DocIdFocusListener.ts                # On focus → ensures doc id (registered first)
        VisitHistoryFocusListenerDefault.ts  # On focus → records visit
        VHFileProvider.ts   # Manages VH files: backlink discovery, ulid-based creation, per-device
      data/FocusFile.ts     # Represents a single VH focus file
    service/
      visitHistoryService/  # VisitHistoryService: record visits, last-visit stamps
      docId/                # DocIdService (dispatch by extension), DocIdGenerator
                            # (docid_{21 base62}_E), FrontmatterDocIdStore (md),
                            # CanvasDocIdStore (canvas JSON), DocIdBackfillService
                            # (vault-wide backfill; concurrent calls JOIN)
    data/                   # FileTimeMetadata, VaultNode (heatmap tree node)
    util/                   # vault/ (VaultUtil, IsTrackedProvider),
                            # file/note/ (NoteFileUtil — vault file I/O),
                            # async/ (InFlightDropGuard — per-key dedup, DROP semantics),
                            # env/ (DeviceNameProvider), userComm/ (UserNotifier),
                            # linkUtil/ (backlink resolution)

  settingsTab/              # VisitHistorySettingTab (Settings → Visit History):
                            # "File modifying actions" (doc id backfill) behind a
                            # ConfirmModal; actions only, no persisted settings

  testSupport/              # Test-only fakes + runtime stand-in for 'obsidian'
                            # (the npm package is types-only; see vitest.config.ts)

  view/                     # React UI (Obsidian-agnostic except VaultTreemapView)
    VaultTreemapView.tsx    # Obsidian ItemView boundary — mounts React, handles vault events
    components/             # App (config state owner), TreemapViz (SVG treemap + zoom),
                            # Header, ConfigPanel/, FolderNode, LeafNode, Tooltip, Legend
    constants.ts, utils.ts  # Palettes + HeatField/GradientKey unions; pure color/format helpers

  viewModel/
    buildVaultTree.ts       # TrackedFile[] → VaultNode tree (single vault walk)
    FileOpener.ts           # IFileOpener interface + ObsidianFileOpener impl
```

### Key design decisions

- **PluginFactory** is the DI container. `main.ts` calls it once. All dependencies are constructor-injected — no service locators, no global state.
- **VaultTreemapView** is the **only file** in `view/` that imports from `obsidian`. All React components are Obsidian-agnostic and receive data/callbacks as props.
- **VH files** live under `_visit_history/v1/focus/<device>/` with ulid-based filenames. The backlink to the source note is embedded in the file content — the filename is never derived from the note title (which can change).
- **Visit deduplication**: focus listeners use `InFlightDropGuard` (`core/util/async/`) — in-flight promise tracking with DROP semantics — to avoid duplicate writes on rapid focus events. `VisitHistoryService` additionally skips consecutive records to the same VH file — intentionally NOT time-window based, so A→B→A navigation pathways stay fully recorded (owner decision).
- **Doc ids**: every focused document gets a persistent id `docid_{21 base62}_E`. md (incl. `.excalidraw.md`) → frontmatter `id`; canvas → `metadata.frontmatter.id`; raw `.excalidraw` skipped (no id location — owner decision). An existing id — any format — is used as-is and the file is NOT modified; an unusable occupied id slot (e.g. nested mapping) is never overwritten. Writes are atomic raw-text edits via `Vault.process` that only add/fill the id line — Obsidian's `FileManager.processFrontMatter` is deliberately NOT used (it re-serializes the whole frontmatter block, mangling formatting of keys we don't own, e.g. stripping quotes). Vault-wide backfill (settings tab) reuses the same `ensureDocId` path per file.
- **LRU caching** (instance fields, never module-level): `VisitHistoryServiceDefault` caches last-visit stamps (10k entries); `VHFileProvider` caches self-created VH file paths (500 entries, 1min TTL). Cached only for paths we control — never for backlink-resolved paths.
- **Malformed files never throw**: `FocusFile.getLastStamp` and `CanvasDocIdStore` return `null` for unparseable content so one bad file can't break aggregation or focus handling.
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
