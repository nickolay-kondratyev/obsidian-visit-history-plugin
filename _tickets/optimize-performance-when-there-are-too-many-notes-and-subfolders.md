---
closed_iso: 2026-10-22T18:03:46Z
session_ids: [{"a": "claude", "type": "execution", "id": "0ac51d51-ca91-484a-abf5-890fc36a379b"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_zxh1nwsmchemmzg2fdwu98y22_e
title: "Optimize performance when there are too many notes and subfolders"
status: closed
deps: []
links: []
created_iso: 2026-10-22T17:53:55Z
status_updated_iso: 2026-10-22T18:03:46Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
---

Let's optimize performance of the heatmap when there are too many notes and subfolders to render.

Instead of individually rendering them lets have visualization of a folder and state how many notes are in this folder.

The folder for now we will use the coloring of the most recent note (depending on the type of coloring).

Then the user can click into the folder like already can.

Come up with logical hueristic of when to allow display of individual notes in the folder and when to collapse. 

## Resolution (2026-10-22)

**Built:** dense-folder collapse in the heatmap treemap.

- **Heuristic** — `src/viewModel/partitionTreemapNodes.ts` (pure, unit-tested):
  after the single d3 layout pass, walk top-down from the view root; a folder
  whose rect gives its files less than `MIN_AREA_PER_FILE_PX2` (32×32 px) on
  average collapses into ONE tile (descendants not rendered). The 32 px side
  is tied to the leaf-title label threshold (`TILE_TITLE_MIN_WIDTH_PX`).
  WHY area-per-file rather than a fixed file count: it adapts to screen size
  and drill-down depth, and it bounds the number of rendered file tiles to
  ≈ viewport area / 1024 regardless of vault size (the perf guarantee).
  O(n): file counts + representatives are computed in one `eachAfter` pass.
- **Rendering** — `src/view/components/CollapsedFolderNode.tsx`: tile with
  the folder name (uppercase) top-left, `"N files"` bottom-right (when it
  fits), dashed border (folder, not file), native `<title>` tooltip; click
  drills in via the same handler as `FolderNode`.
- **Color** — the "most recent" file = max of the ACTIVE heat field
  (created / modified / visited) among the folder's files; the tile uses
  that file's color in both modes (heatmap → its heat color; type mode → its
  type color). All-null → first file (heatmap shows the "no data" color).
- **Stats / empty-state** (`TreemapViz.computeTotals`) still count ALL files
  and folders in the view, incl. those inside collapsed folders.
- Docs: `docs/heatmap-view.md` ("Dense-folder collapse"), CLAUDE.md/AGENTS.md.

**Assumptions made (non-interactive run; see `_agent_decisions/needs_review/heatmap-dense-folder-collapse.md`):**
- Label says "files", not "notes" — the count includes canvases/drawings and
  the header stats already say "files".
- Known ceilings: the collapse is decided on the UNZOOMED layout — zooming in
  does not expand a collapsed folder (upgrade: re-partition per zoom scale);
  the view root's own direct files are never collapsed (only folders do).
- Collapsed tiles use the native SVG title tooltip, not the rich file tooltip.

Verified: `npm test` 511/511, `npm run lint` 0 errors, `npm run build` OK.
Not verified in a running Obsidian (no visual/manual check in this run).
