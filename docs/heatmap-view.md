# Vault Heatmap View

Zoomable treemap of the vault, colored by file activity. Opened via the
`Open vault heatmap` command, the ribbon icon, or a folder's file-tree
context menu ("Open heatmap for folder" — opens pre-drilled into that
folder; "back" still walks up through every ancestor to the vault root).

A vault-level open (command / ribbon) that finds an existing vault-level
heatmap CURRENTLY at the vault root reveals it silently instead of
duplicating (`VaultRootHeatmapFinder` + `VaultTreemapView.isAtVaultRoot()`);
a drilled-in vault view or any folder-targeted view never blocks a fresh
open.

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
                                          and on every recorded visit session
                                          (refreshOpenHeatmaps — VH writes are
                                          invisible to the Vault API)
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

Folder-note following (setting `heatmapFollowsFolderNotes`, default ON, read
live): on workspace `file-open` of a FOLDER NOTE (`viewModel/FolderNoteRule.ts`:
name minus extension == its parent folder's name — INSIDE, `Projects/Projects.md`
— or == an existing folder next to it — SIBLING, `Projects.md` beside
`Projects/`; INSIDE wins when both apply), every open heatmap drills into that folder — same state change as clicking
it. `App` hands the host its drill function via
`registerFollowFolder` (like the zoom-reset relay). A folder absent from the
tree (e.g. created moments ago, before the debounced refresh) is ignored
rather than falling back to the root. Opening a non-folder note never moves
the view. Ceiling: `index.md` and `.excalidraw.md` folder notes are not
recognized.

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
`path`, `type` (`md`/`canvas`/`excalidraw`), `size`, the three timestamps,
and `totalFocusMs` (summed closed focus sessions, all users/devices).

## Component tree & state

```
App                     state owner: HeatmapConfig (color mode, gradient,
 │                      heat field, hot/cold thresholds, sizeBy + per-mode
 │                      sizing (curve + scales), filter terms), folder drill-down (folderSegments),
 │                      openPanel ('filter'|'field'|'info'|'config'|null —
 │                      at most ONE popover/panel open), contentMatchedPaths
 ├─ Header              actions only: breadcrumb + back, FilterGroup,
 │                      clustered-timestamps + hidden-notes banners, zoom reset (action lives in TreemapViz — bridged
 │                      up through a ref registered via registerResetZoom)
 │   └─ FilterGroup     filter icon trigger + removable term chips
 │                      (kind = glyph + tint + title, never color alone)
 ├─ FilterPopover       kind SegmentedToggle + Enter-to-add input
 ├─ FieldPopover        heat-field RadioGroup (SAME FIELD_OPTIONS as the
 │                      config panel — extracted to view/constants.ts)
 ├─ InfoPopover         title + stats + Legend (the collapsed header info)
 ├─ ConfigPanel         SegmentedToggle (color mode), HeatmapOptions
 │                      (field RadioGroup, gradient dropdown,
 │                      hot/cold RangeSliders), "Size" section (size-by
 │                      + curve SegmentedToggles, ACTIVE mode's per-type
 │                      scale RangeSliders)
 └─ TreemapViz          d3 treemap layout (useMemo), @visx/zoom pan/zoom,
     │                  hover + edge-flipping tooltip, filter empty-state,
     │                  all-unvisited empty-state ("size by content" CTA)
     ├─ FolderNode      click → drill into subtree (root-relative segments)
     ├─ CollapsedFolderNode  dense folder as ONE tile: name + "N files",
     │                  most-recent-file color, dashed border; click → drill in
     ├─ LeafNode        click → TileTapRules (mouse: open; touch: select);
     │                  wrapped title
     │                  top-left, active-field age ("3d ago" — created/modified/
     │                  visited per the timestamp field) bottom-right when the
     │                  tile fits title + blank line + label (TileLabelLayout)
     ├─ Tooltip         hover (mouse/pen only) ─┐ both render FileDetails
     └─ FileDetailsCard touch-selected file ─────┘ (name + stats) — one source
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

## Touch input

Pure rules in `viewModel/TileTapRules.ts` (unit-tested), decided PER EVENT
from the pointer type (a touchscreen laptop mixes both):

- **Mouse / pen** (unchanged): hover shows the tooltip, a click opens the file
  or drills into a folder.
- **Touch**: a tap on a file tile SELECTS it (accent ring) and docks a
  `FileDetailsCard` at the bottom of `#viz` — full name, the tooltip's stats
  (shared `FileDetails`), a touch-sized **Open** and a close button (tiles
  cover nearly all of the canvas, so "tap empty space" alone is a thin
  target). Open, or a second tap on the selected tile, opens the file; another
  tile moves the selection; empty space closes the card; a folder (incl.
  collapsed) drills in at once and closes it. Long-press is NOT used (Obsidian
  mobile = context menu).

Mechanics (`TreemapViz`): the pointer kind comes from the canvas's latest
`pointerdown` (capture) — every `click` has its own. A touch tap is handled on
its ONE `click`; hover listens to POINTER events only, so the browser's compat
mouse events after a tap neither flash the tooltip nor act twice. A pan/drag
never reaches the handlers: @visx/zoom's @use-gesture drag (`filterTaps`)
swallows the click that ends a drag; the canvas sets `touch-action: none` so the
browser never claims a touch pan as a scroll (pointercancel), and `#viz` carries
`data-ignore-swipe` so Obsidian mobile's drawer swipe (a bubble-phase
`touchstart` on `.workspace`; undocumented, verified on 1.14.4 Android) skips
touches that start on the canvas; swipes elsewhere still open the drawers
(`e2e/heatmapMobileSwipe.e2e.ts`, via `app.emulateMobile`).
Tiles stop click propagation, so a click
reaching the svg means empty space. The selection is a file PATH; the card
derives from the rendered leaves (a refresh/filter that removes the file
closes the card and drops the selection). Covered by `e2e/heatmapTouchTap.e2e.ts` (real CDP touch input).

## Dense-folder collapse

`viewModel/partitionTreemapNodes.ts` splits the laid-out treemap (top-down)
into rendered folders, collapsed folders and leaves. A folder below the view
root whose rect gives each of its files (all depths) less than
`MIN_AREA_PER_FILE_PX2` (32×32 px — fixed, independent of the label font) on average
collapses into ONE `CollapsedFolderNode` tile; its subtree is not rendered.
The tile is colored like its most recent file (max of the active heat field;
all-null → first file) in both color modes. This bounds rendered file tiles
to ≈ viewport area / 1024 regardless of vault size (perf). Header stats and
the filter empty-state still count ALL laid-out files (computed from the full
hierarchy, not the partition). A collapsed tile's area is the d3 sum of its
files' tile values, so it follows the active sizing mode, curve and scales.

Ceiling: decided on the UNZOOMED layout — zooming in does not expand
collapsed folders (upgrade path: re-partition per zoom scale); the view
root's own direct files never collapse.

## Tile labels

Pure rules in `viewModel/label/` (DOM-free; unit-tested with a fake measurer):

- `LabelLineFitter` breaks a name into lines by MEASURED char widths — at
  whitespace, after `-` `_` `.`, or next to any CJK char (a token with no break
  point breaks anywhere); the last allowed line ends in "…" when cut.
- `TileLabelLayout` decides show/hide + placement from the tile's ON-SCREEN
  (zoomed) size: file titles wrap over as many lines as fit; collapsed-folder
  titles and folder headers are one line; a shown corner label reserves its own
  bottom line (the title never overlaps it). So zooming in reveals names.
- Labels render inside a `scale(1 / zoom)` group (`TileLabelText`, one
  `<tspan>` per line) → constant on-screen font size at every zoom.
  NOT `<foreignObject>`: iOS WebKit misplaces it under transformed parents.
- Font size lives only in `styles.css` (`.leaf-node__label`, 11 px);
  `view/label/CanvasLabelFontProbe` reads the rendered fonts once per mount and
  measures chars with canvas `measureText`, cached per char. Line height
  (1.2 em) and show thresholds derive from that size.
- Perf: fitting is memoized per node on (size, zoom scale, text), so pan and
  hover never re-fit; layout is untouched by zoom.

## Heatmap coloring

- `heatColor(ts)`: newer than `hotDays` → hot color; older than `coldDays` →
  cold color; in between → RGB interpolation; `null` timestamp → `nil` color
  at reduced opacity ("no data").
- **Clustered-timestamps banner**: sync tools stamp every downloaded file
  with the download time (modified AND created; visit history never syncs),
  so a freshly synced vault renders in one uniform color. When the laid-out
  files of the CURRENT view (after prune/filter/visit-time hiding) are
  clustered on the color field, the header explains it ("N of M notes have
  the same modified time, probably from a sync…"; wraps to two lines — no
  hover on touch). Rule: `core/util/time/TimestampClusterDetector` (≥50% of
  ≥20 files inside one 60 s window; returns the members so a restore can
  target them); gating: `viewModel/ClusteredTimestampsRule` (heatmap color
  mode + modified/created only; App drops a finding stale vs. the live
  field). Stateless — derived per render, no "last sync" state.
- **Restore from git**: when `.git` is a FOLDER at the vault root, a
  modified-time banner (not created — the restore never sets created times)
  carries a "Restore from git" button; the command
  `restore-modified-times-from-git` runs the same `GitMtimeRestoreAction`.
  Targets = tracked files in the vault-wide mtime cluster (same detector,
  all files). After a confirm modal: hash each target (git blob id), walk
  history from HEAD newest → oldest (`GitCommitTimeResolver`: a file's time
  = the newest commit whose version is HEAD's and none of its parents'; folders
  whose tree id equals a parent's are never opened; stops when all are dated,
  at 20k commits or the shallow boundary — never stamping the boundary), then
  write: re-read the bytes, and only if still HEAD's version write the SAME
  bytes back with the commit time (`Vault.modifyBinary` + `{ mtime }`, so
  `TFile.stat.mtime` updates). Edited/uncommitted/older files keep their mtime
  (also files whose line endings git converted — skipped, the safe side).
  Read errors write nothing. Open heatmaps re-read afterwards
  (`refreshOpenHeatmaps`). Reads `.git` via isomorphic-git (pure JS, local
  read APIs only — no `http`) over a read-only DataAdapter fs, so it runs on
  mobile; `Buffer` is bundled via esbuild `inject` (no global assigned).
  Ceiling: isomorphic-git loads packfiles into memory; ~15 ms per commit on
  the Android emulator (1.5k commits ≈ 22 s).

## Tile sizing

Pure rules in `viewModel/tileSize.ts`; `App` resolves the ACTIVE mode into a
`TileSizing` (slider bounds stripped) for `TreemapViz`.

- **Size by** (`HeatmapConfig.sizeBy`): `contentSize` (bytes, default) or
  `visitTime` (`totalFocusMs` in SECONDS — so a few seconds of focus isn't
  thousands of units).
- **Curve** per mode: `linear` = raw, `sqrt` = √raw, `log` = log1p(raw).
  Default `sqrt` for BOTH modes — keeps a few huge files / heavily visited
  daily notes from swallowing the map. Behavior change: the content view was
  linear before; upgraded configs (no curve saved) get `sqrt`.
- Tile value = `curve(raw) × typeScale`, NOT rounded (sqrt/log values are
  small; rounding would erase their differences). Content raw is floored at
  1 byte BEFORE the curve so 0-byte notes stay visible.
- Each mode saves its own curve + per-type scales (`sizing.contentSize` /
  `sizing.visitTime`); switching modes never touches the other's values.
  Content defaults down-weight canvas ×0.3 / excalidraw ×0.2 so prose
  dominates; visit-time defaults are ×1 for all types. The sanitizer still
  reads the pre-per-mode top-level `scales` key as the content scales
  (legacy read, cleanup after 2027-April).
- **Hidden notes** (visit-time only): notes with no focus time are LEFT OUT
  of the layout (`hideUnvisitedFiles`, after archive pruning and filters);
  folders left empty disappear. The header banner (`N notes hidden · no
  visit history`, full sentence on hover) counts them for the CURRENT view.
  If every note in the view is hidden, an empty state offers "size by
  content". Raw `.excalidraw` files never get a doc id, so they are always
  hidden here (accepted gap). Visit times refresh when a session is
  recorded (i.e. once it closes — ~10 s after leaving the note).
- Tooltip shows "visited for" (total focus) and "tile size" — the active
  computation, e.g. `sqrt(12.3 KB) ×0.30` or `log(3h 05m) ×1.00`.

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

Button rules are written as `.vault-heatmap-view button.<class>`, not
`.vault-heatmap-view .<class>`: Obsidian for tablets adds
`.is-tablet button:not(.clickable-icon) { padding: 4px 20px }` (specificity
0,2,1), which beats a 0,2,0 class rule and squeezed the 28px icon buttons'
SVGs to 0 width. A new `<button>` class in the view must follow the same
pattern (the details card's Open/close do). Anything rendered INSIDE `#viz`
(the details card) must also out-specify the canvas rule `#viz svg` (100% size,
grab cursor) for its own icons. Check on the tablet emulator (`docs/android-tablet-testing.md`).
The same applies to text inputs: Obsidian mobile's `.is-mobile input[type="text"]
{ width: 100% }` (0,2,1) widened the slider bound inputs and squeezed the range
tracks to 0px, so their rule carries an extra class (0,3,0).

Narrow panes (phone, tablet split view): the breadcrumb shrinks first and
ellipsizes (full path in its title), and below a 480px pane width (a container
query on `.vault-heatmap-view`) the header tightens its gaps and hides the
`field:` button — the config panel's timestamp-field radios do the same job.
Covered by `e2e/heatmapMobileLayout.e2e.ts`.
