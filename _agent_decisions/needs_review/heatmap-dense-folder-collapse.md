# Heatmap: dense-folder collapse heuristic

Ticket: nid_zxh1nwsmchemmzg2fdwu98y22_e

Decisions made without a human (please review):

1. **Collapse rule = area per file, not file count.** A folder collapses when
   `rect area / file count < 32×32 px` at the unzoomed layout. Adapts to
   window size and drill depth; caps rendered tiles to ≈ viewport area / 1024.
   Tuning knob: `MIN_FILE_TILE_SIDE_PX` in `src/viewModel/partitionTreemapNodes.ts`.
   Side effect: small folders in ordinary vaults (e.g. 5 files in a 60×60 px
   box) now show as one tile too — intended ("too small to read anyway").
2. **"Most recent" = active heat field** (created / modified / visited), used
   for coloring in both color modes.
3. **Label "N files"** (not "notes") — includes canvases/drawings; matches header stats.
4. **Zoom does not expand collapsed folders** — click to drill in instead.
   Zoom-aware re-partitioning is the upgrade path if wanted.
