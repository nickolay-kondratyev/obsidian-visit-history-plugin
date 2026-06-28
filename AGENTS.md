# Visit History Plugin

Records visit history of notes, canvases, and Excalidraw drawings. When you focus a file, a timestamp is appended to a per-file visit history log under `_visit_history/`. Also provides a treemap heatmap visualization of vault file activity.

## Project overview

- Obsidian Community Plugin: TypeScript → esbuild → `main.js`
- Release artifacts: `main.js`, `manifest.json`, `styles.css`
- Entry point: `src/main.ts` (Obsidian Plugin subclass)

## Dev environment

```bash
npm install        # install dependencies
npm run dev        # watch mode
npm run build      # production build (tsc + esbuild)
npm run lint       # ESLint
```

- Node 18+, npm, esbuild bundler
- `tsconfig.json`: strict, ES2021, React JSX (`react-jsx`)
- Dependencies: React 18, d3-hierarchy, d3-color, d3-interpolate, visx/zoom, lru-cache, ulid

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
        VisitHistoryFocusListenerDefault.ts  # On focus → records visit via VisitHistoryService
        VHFileProvider.ts   # Manages VH files: backlink discovery, ulid-based creation, per-device
      data/
        FocusFile.ts        # Represents a single VH focus file
    service/
      visitHistoryService/
        VisitHistoryService.ts  # Interface + default impl. Records visits, retrieves last-visit stamps
    data/
      FileTimeMetadata.ts   # created/modified/visited timestamps per file
      VaultNode.ts          # Tree node for heatmap visualization (folder or leaf)
    util/
      vault/                # VaultUtil, IsTrackedProvider
      file/note/            # NoteFileUtil — vault file I/O
      env/                  # DeviceNameProvider
      userComm/             # UserNotifier (notices/warnings)
      linkUtil/             # Backlink resolution
      out/                  # Logging abstraction

  view/                     # React UI (Obsidian-agnostic except VaultTreemapView)
    VaultTreemapView.tsx    # Obsidian ItemView — mounts/unmounts React, handles vault events
    components/
      App.tsx               # Top-level state owner
      Header.tsx            # Stats bar + config toggle
      ConfigPanel/          # Color mode, gradient, field, scale settings
      TreemapViz.tsx        # SVG treemap rendering
      FolderNode.tsx        # Folder rect + on-click zoom
      LeafNode.tsx          # File rect + on-click open
      Tooltip.tsx           # Hover tooltip
      Legend.tsx            # Color legend
    constants.ts            # Color palette definitions
    utils.ts                # Treemap geometry helpers

  viewModel/
    buildVaultTree.ts       # Walks vault files → constructs VaultNode tree
    FileOpener.ts           # IFileOpener interface + ObsidianFileOpener impl
```

### Key design decisions

- **PluginFactory** is the DI container. `main.ts` calls it once. All dependencies are constructor-injected — no service locators, no global state.
- **VaultTreemapView** is the **only file** in `view/` that imports from `obsidian`. All React components are Obsidian-agnostic and receive data/callbacks as props.
- **VH files** live under `_visit_history/v1/focus/<device>/` with ulid-based filenames. The backlink to the source note is embedded in the file content — the filename is never derived from the note title (which can change).
- **Visit deduplication**: `VisitHistoryFocusListenerDefault` uses in-flight promise tracking with DROP semantics to avoid duplicate writes on rapid focus events.
- **LRU caching**: `VisitHistoryServiceDefault` caches last-visit stamps (10k entries); `VHFileProvider` caches self-created VH file paths (500 entries, 1min TTL). Cached only for paths we control — never for backlink-resolved paths.

## TypeScript & React rules

### TypeScript

- **Strict mode** (`"strict": true`). No implicit `any`. Use `noUncheckedIndexedAccess`.
- **Prefer interfaces** for public APIs; use `type` for unions and narrow helpers.
- **No `as` casts** except at system boundaries (e.g. Obsidian API gaps). Casting hides bugs — prefer type guards or explicit validation.
- **Explicit return types** on public methods (not inferred).
- **`readonly`** on constructor-injected dependencies and fields set once.
- **Avoid `null`** where `undefined` suffices. Use `null` only when it carries distinct meaning from absent.
- **No enums** — use string literal unions (`type Foo = 'a' | 'b'`).
- **No default exports** except for the Plugin class itself (`main.ts`).

### React

- **Functional components only** (no class components). Hooks for state and effects.
- **Props drilling** over context — this app is small; context adds indirection without benefit.
- **State colocation**: state lives in the nearest common ancestor that needs it. `App.tsx` is the state owner for config; `TreemapViz` owns zoom/transform state.
- **Obsidian-agnostic components**: React components never import from `obsidian`. They receive data and callbacks as props. The Obsidian boundary is `VaultTreemapView`.
- **No React.memo** unless profiling shows a specific render bottleneck.
- **One component per file** unless a sub-component is truly private and trivial (≤20 lines).
- **CSS via `styles.css`** at plugin root — keep style with style, not in JS.

### General OOP

- **SRP**: one reason to change per class. One thing per method.
- **Self-contained classes**: logic about a concept lives in the class for that concept — don't spread it across "managers" or "utilities."
- **DIP**: depend on interfaces, not concretions. `PluginFactory` wires concretions at construction.
- **OCP via composition**: new behavior = new interface implementation, not modification of existing classes.
- **No free-floating functions** in modules that should be classes. Stateless utility functions OK in well-named static utility classes.

## Testing

### Philosophy

- **Logical coverage over line coverage**. Test the space of possible inputs, states, and edge cases — not just execution paths. A test suite that covers every line but ignores boundary conditions gives false confidence.
- **Tests are documentation**. A reader should understand what a class does by reading its tests.
- **One assert per test** where practical. GIVEN/WHEN/THEN structure for clarity.

### When to test

- **Every new class** that contains logic (not pure data holders or trivial delegation) gets a test file.
- **Bug fixes**: start with a failing test that reproduces the bug.
- **Critical paths** (visit recording, VH file management, tree building) must have tests before refactoring.

### How to test

- **Test files mirror source structure**: `src/core/foo/Bar.ts` → `src/core/foo/Bar.test.ts`
- **Isolate the unit**: mock only at system boundaries (Obsidian APIs). Test the class's own logic directly.
- **Test behavior, not implementation**: when you refactor internals without changing behavior, tests should not break.
- **Cover edge cases explicitly**: null/undefined inputs, empty collections, duplicate events, concurrent operations, boundary timestamps.
- **No Jest globals** — explicit imports for `describe`, `it`, `expect`.

### Test structure

```ts
describe('ClassName', () => {
  describe('methodName', () => {
    it('should DO_THING when CONDITION', async () => {
      // GIVEN ...
      // WHEN ...
      // THEN ...
    });
  });
});
```

## Obsidian plugin conventions

### Lifecycle

- Use `this.registerEvent()`, `this.registerDomEvent()`, `this.registerInterval()` for all cleanup.
- `onload()` should be lightweight — defer heavy work, use lazy init.
- `onunload()` must release all resources (React roots, intervals, listeners).

### Commands & settings

- Stable command IDs — never rename after release.
- Settings persisted via `this.loadData()` / `this.saveData()`.
- Sentence case for setting labels and UI text.

### Security

- No network calls (this plugin is fully offline/local).
- No telemetry, no data collection outside the vault.
- Only reads/writes within the vault (`_visit_history/` directory).

### Releases

- Bump `version` in `manifest.json` (SemVer).
- Update `versions.json` for minAppVersion mapping.
- GitHub release tag = manifest version (no `v` prefix).
- Attach `main.js`, `manifest.json`, `styles.css` to release.

## Build & file conventions

- Source in `src/`; output at plugin root (`main.js`, `main.js.map`).
- **Never commit** `node_modules/`, `main.js`, or build artifacts.
- Files >200-300 lines → consider splitting.
- Keep the plugin small; avoid large dependencies.

## Common commands

```bash
npm run build       # production build
npm run dev         # watch mode
npm run lint        # ESLint
npm run version     # bump version + update manifest/versions
```
