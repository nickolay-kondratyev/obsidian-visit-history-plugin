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
  └─ React root ← <App data fileOpener initialFolderPath>
                                          re-rendered on vault
                                          create/delete/rename (500 ms debounce)
```

Folder targeting: the `file-menu` handler (`main.ts`) opens the view with
`{ folderPath }` in its view state (persisted via `getState`). `App` resolves
it to an ancestor trail with `viewModel/folderTrail.ts` and seeds the nav
stack; the App is keyed by folder path so re-targeting remounts fresh.

Archive hiding: folders named `_archive` are hidden below the current view
root — `viewModel/pruneArchiveFolders.ts` prunes them (and folders left
empty by the prune) inside `TreemapViz` before layout. Scoping INTO an
archive (its file-tree context menu → "Open heatmap for folder") shows its
contents; backing out hides it again. While the view root is at or under an
`_archive` (`isWithinArchive` on App's nav stack), pruning is skipped
entirely — nested archives stay visible, so moving one archive under
another never loses visibility into it.

`VaultNode` is a dual-purpose tree node: folders have `children`; leaves have
`path`, `type` (`md`/`canvas`/`excalidraw`), `size`, and the three timestamps.

## Component tree & state

```
App                     state owner: HeatmapConfig (color mode, gradient,
 │                      heat field, hot/cold thresholds, per-type scales —
 │                      all as value+bounds), folder drill-down
 │                      (currentRoot + navStack)
 ├─ Header              stats, breadcrumb + back, legend, config toggle
 ├─ ConfigPanel         SegmentedToggle (color mode), HeatmapOptions
 │                      (field RadioGroup, gradient dropdown,
 │                      hot/cold RangeSliders), per-type scale RangeSliders
 └─ TreemapViz          d3 treemap layout (useMemo), @visx/zoom pan/zoom,
     │                  hover + edge-flipping tooltip
     ├─ FolderNode      click → drill into subtree
     ├─ LeafNode        click → IFileOpener.openFile(path)
     └─ Tooltip
```

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
for computed values like gradient previews).
