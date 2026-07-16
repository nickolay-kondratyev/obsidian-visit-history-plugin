# Vault Heatmap View

Zoomable treemap of the vault, colored by file activity. Opened via the
`Open vault heatmap` command, the ribbon icon, or a folder's file-tree
context menu ("Open heatmap for folder" — opens pre-drilled into that
folder; "back" still walks up through every ancestor to the vault root).

While a heatmap view is the active view, Obsidian's status bar is hidden:
an `active-leaf-change` listener in `main.ts` toggles the
`vault-heatmap-active` body class and `styles.css` does the hiding —
CSS-only, so leaving the view (or unloading the plugin) restores the status
bar to whatever state other plugins/themes gave it.

## Data flow

```
VaultTreemapView (Obsidian ItemView — the only obsidian import in view/)
  ├─ VaultUtil.getTrackedFiles()      one vault walk; visit stamps included
  ├─ buildVaultTree(name, files)      TrackedFile[] → VaultNode tree
  └─ React root ← <App data fileOpener configStore
                        contentTermMatcher initialFolderPath>
                                          re-rendered on vault
                                          create/delete/rename (500 ms debounce)
```

Folder targeting: the `file-menu` handler (`main.ts`) opens the view with
`{ folderPath }` in its view state (persisted via `getState`). It seeds
`App`'s nav state; the App is keyed by folder path so re-targeting remounts
fresh.

Drill-down nav is PATH-based: `App` stores only `folderSegments` (vault-
relative folder path) and derives the ancestor trail / current root from the
canonical tree each render (`viewModel/folderTrail.ts`). WHY: TreemapViz
renders pruned/filtered COPIES — storing clicked nodes would pin navigation
to a stale copy (filter removals could never restore files; vault refreshes
would keep showing old subtrees). Folder clicks append the clicked node's
root-relative segments; "back" drops the last segment (one level at a time);
an unresolvable path falls back to the vault root.

Archive hiding: folders named `_archive` are hidden below the current view
root — `viewModel/pruneArchiveFolders.ts` prunes them (and folders left
empty by the prune) inside `TreemapViz` before layout. Scoping INTO an
archive (its file-tree context menu → "Open heatmap for folder") shows its
contents; backing out hides it again. While the view root is at or under an
`_archive` (`isWithinArchive` on App's derived trail), pruning is skipped
entirely — nested archives stay visible, so moving one archive under
another never loses visibility into it.

## Filtering

Include-only filter with two term kinds, OR across ALL terms
(`viewModel/heatmapConfig.ts`: `FilterTerm`):

- **path** — case-insensitive substring of the file's FULL vault path
  (folder names included).
- **content** — case-insensitive substring of file content. Resolved at the
  Obsidian boundary by `ContentTermMatcher`
  (`viewModel/ContentTermMatcher.ts`, wired in `PluginFactory`, injected
  into `App` as a prop): one pass over `VaultUtil.getTrackedTFiles()` with
  `cachedRead` per content-term-set change (no index; a failed read logs and
  counts as non-match). `App` runs a latest-wins effect (deps: content term
  set AND `data`, so renames re-resolve; file EDITS are accepted-stale like
  the rest of the tree) producing `contentMatchedPaths` — `undefined` means
  content filtering is inactive, an EMPTY set means "terms exist, nothing
  matched (or scan pending)".

The tree filter itself is pure: `viewModel/filterVaultTree.ts` (mirrors
`pruneArchiveFolders` — copy, drop non-matching leaves, prune emptied
folders, identity fast-path when inactive), composed AFTER archive pruning
in TreemapViz's `treeRoot` memo, so stats/legend automatically reflect the
filtered view. A zero-match active filter shows a centered empty-state
message with a "clear filters" escape hatch (removes ALL terms — the chips
may be scrolled out of view). Terms persist in
`HeatmapConfig.filterTerms` (data.json) — sticky
across restarts and drill-down. `FilterTermOps` normalizes UI adds (trim,
per-kind case-insensitive dedupe); `HeatmapConfigSanitizer` enforces the
same rules at the data.json boundary.

`VaultNode` is a dual-purpose tree node: folders have `children`; leaves have
`path`, `type` (`md`/`canvas`/`excalidraw`), `size`, and the three timestamps.

## Component tree & state

```
App                     state owner: HeatmapConfig (color mode, gradient,
 │                      heat field, hot/cold thresholds, per-type scales,
 │                      filter terms), folder drill-down (folderSegments),
 │                      openPanel ('filter'|'field'|'info'|'config'|null —
 │                      at most ONE popover/panel open), contentMatchedPaths
 ├─ Header              actions only: breadcrumb + back, FilterGroup,
 │                      zoom reset (action lives in TreemapViz — bridged
 │                      up through a ref registered via registerResetZoom)
 │   └─ FilterGroup     filter icon trigger + removable term chips
 │                      (kind = glyph + tint + title, never color alone)
 ├─ FilterPopover       kind SegmentedToggle + Enter-to-add input
 ├─ FieldPopover        heat-field RadioGroup (SAME FIELD_OPTIONS as the
 │                      config panel — extracted to view/constants.ts)
 ├─ InfoPopover         title + stats + Legend (the collapsed header info)
 ├─ ConfigPanel         SegmentedToggle (color mode), HeatmapOptions
 │                      (field RadioGroup, gradient dropdown,
 │                      hot/cold RangeSliders), per-type scale RangeSliders
 └─ TreemapViz          d3 treemap layout (useMemo), @visx/zoom pan/zoom,
     │                  hover + edge-flipping tooltip, filter empty-state
     ├─ FolderNode      click → drill into subtree (root-relative segments)
     ├─ LeafNode        click → IFileOpener.openFile(path)
     └─ Tooltip
```

Popovers are always-rendered siblings of `#header` (it clips overflow),
shown via an `.open` class — the ConfigPanel pattern. All four panels close
on click-outside: App wraps the header chrome (header + popovers + config)
in one ref'd div and listens for pointerdown on its `ownerDocument` (popout
windows) while a panel is open. Esc dismissal is still ticketed.

Header icons (filter funnel / zoom-reset corners / info / config sliders /
chip ✕) are one lucide-style stroked-SVG family in
`view/components/icons.tsx` — colorless (`currentColor`), sized via CSS
(`.vt-icon`), uniform 28×28 triggers.

- Props drilling by design (small app, no context).
- Types are compile-time-safe unions: `ColorMode` (`type | heatmap`),
  `HeatField` (`createdAt | lastModifiedAt | lastVisitedAt`) and
  `GradientKey` (`nature | ember | mono`) — see `view/constants.ts`.
- Pure color/format helpers live in `view/utils.ts` (unit-tested).

## Config persistence

Config panel state is `HeatmapConfig` (`viewModel/heatmapConfig.ts`):
color mode, gradient, heat field, plus `BoundedValue`s — every slider
carries its own USER-EDITABLE `min`/`max` bounds alongside its `value`
(`RangeSlider` renders bound inputs flanking the track).

The config is persisted in the plugin's `data.json` (`settings.heatmap`)
so it sticks across restarts:

- `App` writes every change through `HeatmapConfigStore`
  (`viewModel/HeatmapConfigStore.ts`), handed in by `VaultTreemapView`
  from `PluginFactory`.
- `PluginHeatmapConfigStore` DEBOUNCES saves (slider drags fire a change
  per pixel) and flushes pending writes on plugin unload.
- `HeatmapConfigSanitizer` validates the persisted shape at load
  (data.json is user-editable): invalid fields fall back to defaults,
  out-of-bounds values are clamped, `hot < cold` is enforced.
- Two heatmap views open at once each hold their own state; last save
  wins, and a view picks up persisted config when (re)opened.

## Heatmap coloring

- `heatColor(ts)`: newer than `hotDays` → hot color; older than `coldDays` →
  cold color; in between → RGB interpolation; `null` timestamp → `nil` color
  at reduced opacity ("no data").
- Cell area = file size × per-type scale factor (canvas/excalidraw are
  down-weighted by default so prose dominates).

## Styling

All styles in `styles.css` at plugin root (class-based; inline styles only
for computed values like gradient previews and per-node cell fills).

Theme-awareness: chrome AND the treemap canvas derive from Obsidian theme
vars (`--vt-*` mapping at the top of `styles.css`). Folder chrome uses
`color-mix` over `--vt-text`/`--vt-bg` (depth tiers `folder-node__bg--d1..d4`,
deeper = closer to text color); leaf labels are white with a dark halo
(`paint-order: stroke`) so they stay readable over any cell color in both
themes; `body.theme-light` swaps the type fg tints to their darker badge
shades for chip/badge contrast. Floating surfaces (popovers, config panel,
tooltip) carry a two-part elevation shadow; all custom controls have an
accent `:focus-visible` ring (Obsidian's native button chrome is stripped
within the view).
