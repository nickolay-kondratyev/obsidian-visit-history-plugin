# Vault Heatmap View

Zoomable treemap of the vault, colored by file activity. Opened via the
`Open vault heatmap` command or the ribbon icon.

## Data flow

```
VaultTreemapView (Obsidian ItemView — the only obsidian import in view/)
  ├─ VaultUtil.getTrackedFiles()      one vault walk; visit stamps included
  ├─ buildVaultTree(name, files)      TrackedFile[] → VaultNode tree
  └─ React root ← <App data fileOpener>   re-rendered on vault
                                          create/delete/rename (500 ms debounce)
```

`VaultNode` is a dual-purpose tree node: folders have `children`; leaves have
`path`, `type` (`md`/`canvas`/`excalidraw`), `size`, and the three timestamps.

## Component tree & state

```
App                     state owner: color mode, gradient, heat field,
 │                      hot/cold thresholds, per-type size scales,
 │                      folder drill-down (currentRoot + navStack)
 ├─ Header              stats, breadcrumb + back, legend, config toggle
 ├─ ConfigPanel         scale factors, color mode, HeatmapOptions/GradientPicker
 └─ TreemapViz          d3 treemap layout (useMemo), @visx/zoom pan/zoom,
     │                  hover + edge-flipping tooltip
     ├─ FolderNode      click → drill into subtree
     ├─ LeafNode        click → IFileOpener.openFile(path)
     └─ Tooltip
```

- Props drilling by design (small app, no context).
- Types are compile-time-safe unions: `HeatField`
  (`createdAt | lastModifiedAt | lastVisitedAt`) and `GradientKey`
  (`nature | ember | mono`) — see `view/constants.ts`.
- Pure color/format helpers live in `view/utils.ts` (unit-tested).

## Heatmap coloring

- `heatColor(ts)`: newer than `hotDays` → hot color; older than `coldDays` →
  cold color; in between → RGB interpolation; `null` timestamp → `nil` color
  at reduced opacity ("no data").
- Cell area = file size × per-type scale factor (canvas/excalidraw are
  down-weighted by default so prose dominates).

## Styling

All styles in `styles.css` at plugin root (class-based; inline styles only
for computed values like gradient previews).
