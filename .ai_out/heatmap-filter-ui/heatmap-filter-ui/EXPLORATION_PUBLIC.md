# EXPLORATION: Heatmap Filter UI

> Written by Explore sub-agent (relayed by TOP_LEVEL_AGENT — agent ran read-only).
> Consumers: CLARIFICATION, PLANNING, REVIEW stages.

## 1. Heatmap view UI structure & the "top row" (Header)

**Render tree:** `VaultTreemapView` (ItemView, only file importing `obsidian`) mounts React `App` → `Header` + `ConfigPanel` + `TreemapViz`.

- `src/view/VaultTreemapView.tsx` — Obsidian host. Builds `VaultNode` tree via `buildVaultTree`, renders `<App>` with `data`, `fileOpener`, `initialFolderPath`, `configStore` (`heatmapConfigStore` from PluginFactory). Remounts App via React `key={folderPath}`.
- `src/view/components/App.tsx` — top-level state owner. Holds `config` (`useState(() => configStore.load())`), `configOpen` (bool toggle), `stats`, and folder drill-down (`navStack`, `currentRoot`). `updateConfig(partial)` merges + `configStore.save(next)`. Passes `onConfigToggle={() => setConfigOpen(o => !o)}` to Header, and `config` + `updateConfig` to ConfigPanel. This is where a filter-terms state + a `filterOpen`/panel toggle would live, and where filtering would be applied to `data`/`currentRoot` before passing to TreemapViz.

**Header (the "top row")** — `src/view/components/Header.tsx` (pure presentational, no state). Left→right children inside `<div id="header">` (flex row, `styles.css:57`):
1. `<span id="title">vault heatmap</span>` — pure info.
2. Breadcrumb group (only if drilled in): `.breadcrumb` > `.breadcrumb-back` button ("← back", ACTIONABLE) + `.breadcrumb-path` (info). Note the existing pattern: a grouped `<div>` with an action button at the left plus text — directly analogous to the requested "filter icon at left-most of the group, terms to its right."
3. `.stats` — three `.stat` spans (files / folders / size) — pure INFO.
4. `.ts-indicator` — "field: <modified>" (only in heatmap colorMode) — pure INFO.
5. `<div className="spacer" />` — flex:1 filler.
6. `<Legend>` (`src/view/components/Legend.tsx`) — pure INFO (color key).
7. `<button className="header-btn" onClick={onConfigToggle}>⚙ config</button>` — the ACTION, currently an emoji + text label. Task wants this reduced to an icon.

So actionable today = back button + config button. Everything else (title, stats, ts-indicator, legend) is pure info → candidates for the collapse-into-INFO-icon requirement.

**ConfigPanel toggle** — `src/view/components/ConfigPanel/index.tsx`. Rendered always but visibility via CSS: `<div id="config" className={open ? 'open' : ''}>`; `#config` is `display:none`, `#config.open` is `display:block` (`styles.css:197,212`). It's an absolutely-positioned panel (top:42px, right:0, width:236px). A "filter" panel would follow the same show/hide-via-`open`-class pattern.

## 2. Config state flow & adding a new (filter) field

- Model: `src/viewModel/heatmapConfig.ts` — `HeatmapConfig` interface, `DEFAULT_HEATMAP_CONFIG`, and `HeatmapConfigSanitizer.sanitize(raw)` (defensive, per-field). Fields today: `colorMode`, `gradKey`, `field`, `hotDays`/`coldDays` (`BoundedValue`), `scales` (Record). Adding `filterTerms: string[]` requires: (a) add to interface, (b) add default `[]`, (c) add a `sanitizeStringArray` branch in `sanitize()` (pattern: coerce non-arrays to default, filter to strings, likely trim/dedupe/lowercase). Sanitizer is boundary-validated because data.json is user-editable.
- Persistence: `src/viewModel/HeatmapConfigStore.ts` — interface `HeatmapConfigStore {load, save}`; impl `PluginHeatmapConfigStore` reads/writes `plugin.settings.heatmap`, debounced 500ms → `plugin.saveSettings()`, flush on unload. No change needed to add a field (whole config object round-trips).
- `src/settings.ts` — `VisitHistoryPluginSettings { idleTimeoutSeconds, heatmap }`; `SettingsSanitizer.sanitize` calls `HeatmapConfigSanitizer.sanitize(raw.heatmap)`. data.json shape: `{ idleTimeoutSeconds, heatmap: {...} }`.
- Wiring: `main.ts` loads/saves settings; `PluginFactory` builds `heatmapConfigStore`. A new field flows automatically through `App.updateConfig` → store → data.json.
- Tests to extend: `src/viewModel/heatmapConfig.test.ts` (sanitizer cases), `src/settings.test.ts`, `src/viewModel/HeatmapConfigStore.test.ts`.

## 3. Where to hook filtering of the tree

Tree pipeline: `buildVaultTree(vaultName, trackedFiles)` (`src/viewModel/buildVaultTree.ts`) builds nested `VaultNode` tree (folders have `children`, leaves have `path/type/size/timestamps`). Then in `TreemapViz` (`src/view/components/TreemapViz.tsx:132`), `treeRoot = showArchived ? root : pruneArchiveFolders(root)` where `root = currentRoot ?? data`.

**Pattern to follow — `src/viewModel/pruneArchiveFolders.ts`:** pure recursive function returning a filtered *copy* (never mutates the shared input tree), dropping matching folders and pruning folders left empty (`.filter(c => !c.children || c.children.length > 0)`). A `filterTree(root, terms)` would mirror this: keep leaves whose name/path matches a term, keep folders that still have children, drop empties. Best insertion point is either in `App` (compute filtered `data`/`currentRoot` in a `useMemo` before passing down) or alongside the existing prune in `TreemapViz`'s `treeRoot` useMemo. `App` is cleaner because stats bubble up from what TreemapViz actually renders (`onStatsChange`), so filtering upstream keeps stats consistent. Note leaves are the only nodes with `path`; folder nodes only have `name`.

## 4. Icons & CSS

- **No Obsidian `setIcon` inside the React view.** `setIcon`/`getIcon` appear only in the Obsidian layer: `main.ts:97` (`.setIcon('layout-grid')` on a context-menu item) and `VaultTreemapView.getIcon()` returns `'layout-grid'`. The React components are Obsidian-agnostic (must stay so — VaultTreemapView is the only file importing `obsidian`).
- **In-view icons today are Unicode/emoji text:** `⚙ config` (Header.tsx:62), `← back` (Header.tsx:36). `<svg>` in the view is only for treemap cells (`FolderNode.tsx:26`, `LeafNode.tsx:44`, `TreemapViz.tsx:250`) — hand-rolled SVG, no icon library. So new INFO/config/filter icons should be either inline SVG or a Unicode glyph inside a `<button>`, to keep the view free of `obsidian` imports. (Using Obsidian `setIcon` would require plumbing through the host or a `useEffect`+ref; not the current pattern.)
- **Header CSS (`styles.css:56-194`):** `#header` = `position:absolute; height:42px; display:flex; align-items:center; gap:14px; padding:0 14px; overflow:hidden`. `.header-btn` (styles.css:142) = bordered pill button, `font-size:10px`, `flex-shrink:0`, hover changes color/border — reuse/restyle this for icon buttons. Info separators use `border-left:1px solid var(--vt-border); padding-left:14px` (see `.stats`, `.ts-indicator`, `.breadcrumb`). The breadcrumb group (`styles.css:162`) is the closest template for a "filter terms group with icon at left." CSS vars in use: `--vt-surface/-border/-border2/-text/-text-dim/-bg`.
- Config panel CSS: `#config` / `#config.open` (styles.css:197/212), `.cfg-h`, `.cfg-label`, `.cfg-select`, `.seg-toggle`. A filter panel/popover can reuse these.

## 5. Tests around view/viewModel

- **vitest** (`vitest.config.ts`): include `src/**/*.test.ts` + `*.test.tsx`; `obsidian` aliased to `src/testSupport/obsidianMock.ts`. `npm test` = `vitest run`.
- **No React component tests and no jsdom/@testing-library installed.** Tested view/viewModel files: `src/view/utils.test.ts`, `src/viewModel/{buildVaultTree,folderTrail,pruneArchiveFolders,BoundedValueOps,HeatmapConfigStore,heatmapConfig}.test.ts`, `src/settings.test.ts`. Pattern = pure-function/class unit tests with GIVEN/WHEN/THEN comments; `HeatmapConfigStore.test.ts` uses `vi.useFakeTimers()` + `vi.stubGlobal('window', {...})`.
- Implication: a new pure `filterTree` fn is directly unit-testable (mirror `pruneArchiveFolders.test.ts`); Header/ConfigPanel React changes have no existing test harness to extend (would need new tooling, likely out of scope).
- Test helpers: `src/testSupport/` (`fakes.ts`, `fileFactory.ts`, `obsidianMock.ts`).

## 6. Existing filter-like functionality

None for user-facing search/term matching. The only "filtering" today: `pruneArchiveFolders` (drop `_archive` folders), `buildVaultTree` type filtering (md/canvas/excalidraw only), and d3 `root.descendants().filter(...)` for splitting folders vs leaves. No search box, no term matching, no highlight. This is a greenfield feature.

## Key facts for CLARIFICATION questions

1. **"Info" vs "action" in current header:** Actions = back button + `⚙ config` button. Pure info = title, `.stats` (files/folders/size), `.ts-indicator` (field), `.legend`. Ambiguous: should the INFO icon collapse ALL of stats + ts-indicator + legend + title, or only some? Legend is arguably semi-actionable-adjacent (color key). Confirm exact set.
2. **What should filter terms match against?** Leaf nodes have both `name` (e.g. `overview.md`) and `path` (e.g. `Projects/Alpha/overview.md`); folder nodes have only `name`. Match filename only, full path, or folder names too? Case-sensitivity? Substring vs whole-word vs glob?
3. **AND vs OR semantics** for multiple terms (union of matches vs intersection). Also: do folders survive if any descendant matches (implied by tree structure)?
4. **Include/exclude:** Are terms inclusive (show only matches) or could they be exclusion filters? Any negation syntax?
5. **Persistence expectation:** Should filter terms persist in data.json like other config (sticky across restarts), or be ephemeral per-session? Persisting is trivial (add `filterTerms` to `HeatmapConfig`); ephemeral means keep in App state only. Task says "config to be an icon... add terms" — implies persistence but unconfirmed.
6. **Filter UI form:** free-text add (chips) vs picking from existing folders/types? "Added terms visible in top row (grouped, filter icon at left-most)" implies removable chips in the header. Confirm add/remove interaction and where the input lives (in a popover/panel like ConfigPanel, or inline in header).
7. **Interaction with drill-down & stats:** should filtering apply within current `currentRoot` only or whole vault; and stats/legend must reflect filtered counts (`onStatsChange` flows from TreemapViz — filter upstream in App to keep them consistent).
8. **Icon rendering constraint:** view must not import `obsidian`; confirm inline-SVG/Unicode icons are acceptable rather than Obsidian's Lucide `setIcon`.
