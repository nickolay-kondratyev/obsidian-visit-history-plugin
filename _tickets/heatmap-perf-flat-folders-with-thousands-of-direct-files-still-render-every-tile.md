---
id: nid_j9j1mc5myj1zfjdgs8nmvjywn_e
title: "Heatmap perf: flat folders with thousands of direct files still render every tile"
status: open
deps: []
links: [nid_zxh1nwsmchemmzg2fdwu98y22_e]
created_iso: 2026-10-22T18:05:18Z
status_updated_iso: 2026-10-22T18:05:18Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [decide]
---

Context: ticket nid_zxh1nwsmchemmzg2fdwu98y22_e added dense-folder collapse to the heatmap (`src/viewModel/partitionTreemapNodes.ts`, rendered by `src/view/components/CollapsedFolderNode.tsx`, wired in `src/view/components/TreemapViz.tsx`). A folder BELOW the view root collapses into one count tile when its rect gives < 32x32 px per file.

Gap: the view root itself never collapses, and loose FILES directly inside it are always rendered one SVG tile each. So:
- a flat vault (thousands of notes at vault root) gets no perf gain at all;
- clicking a collapsed folder that holds thousands of DIRECT files (e.g. a big `daily/` folder) drills in and renders every file again — the exact slow case the collapse was meant to avoid.
The "bounds rendered tiles to ~viewport area / 1024" claim in `docs/heatmap-view.md` (Dense-folder collapse) only holds for files inside sub-folders.

Decide (owner): is this worth handling? Options: (a) accept + keep as documented ceiling; (b) when the root's direct files are too dense, group the smallest/oldest ones into one synthetic "N more files" tile; (c) cap rendered leaves and show a notice. Recommendation: (b) if flat vaults are a real use case, else (a).

Repro: vault with ~10k notes in one folder; open heatmap, drill into that folder; observe render/pan lag.

