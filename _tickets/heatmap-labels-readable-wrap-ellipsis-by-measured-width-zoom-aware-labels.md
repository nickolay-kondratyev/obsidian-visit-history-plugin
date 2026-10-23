---
id: nid_qv6dvik5peosopm9ewks3rkm8_e
title: "Heatmap labels readable: wrap + ellipsis by measured width, zoom-aware labels"
status: in_progress
deps: []
links: [nid_fx5flv7humtg2d6xamfwprvm5_e]
created_iso: 2026-10-23T23:17:24Z
status_updated_iso: 2026-10-23T23:18:22Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin/.worktree/t-qv6dvik5
tags: [heatmap-readability]
---

## Goal

The heatmap treemap is hard to read with many or long note names, especially long Chinese names
(user report). Labels are 9px, cut off hard by the tile edge (no "…"), and drawn only when the
tile is > 32×14 px *before zoom*, so zooming in never reveals a hidden label. We want names to be
readable wherever the tile has room, and "zoom in to read" to work.

## Done criteria

- Before any code change, an e2e spec (or a run of it) produces a BEFORE screenshot in `.out/` of a
  heatmap holding many long Chinese + long Latin file names. After the change, the same spec
  produces an AFTER screenshot. Both paths are reported back.
- Leaf tile names wrap over as many lines as the tile height allows. The last visible line ends
  with "…" when the name still doesn't fit. A name that fits shows in full with no "…".
- Width is measured, not guessed: CJK names wrap and truncate right (no overflow past the tile
  edge, no early cut). Unit tests cover: fits on one line, wraps to N lines, truncated with "…",
  CJK (break between any two characters), Latin with spaces/`-_.` break points, a single
  long token with no break points, tile too small for any label.
- When the bottom-right "ago" corner label is shown (`cornerLabelFits` / `leafFieldAgo` in
  `src/view/utils.ts`), the name never overlaps it.
- Collapsed folder tiles (`src/view/components/CollapsedFolderNode.tsx`) and folder header labels
  (`src/view/components/FolderNode.tsx`) get single-line "…" truncation by measured width (no
  wrapping; the header strip has a fixed height).
- Zoom-aware: show/hide and fitting use the tile's ON-SCREEN (zoomed) size, and label text keeps
  a constant on-screen font size at every zoom level. A tile that is label-less at zoom 1 shows its
  name once zoomed in enough. Covered by a unit test of the fitting rule against the zoom scale.
- Base label font is raised from 9px to 10 or 11px, picked from the AFTER screenshots (report
  which and why). The width/height label thresholds are kept consistent with it.
- Zooming/panning stays smooth on a vault with ~1000 visible tiles: no per-frame layout recompute,
  and text measurement is cached (see Constraints).
- `npm run build`, `npm run lint` (zero errors) and `npm test` pass. Touched e2e specs pass.

## Context

- Leaf rendering: `src/view/components/LeafNode.tsx` (nested `<svg overflow="hidden">`, one
  `<text>` title at y=11, corner label). Label constants + `cornerLabelFits` (5.5 px/char guess —
  wrong for CJK, ~9 px/char at 9px): `src/view/utils.ts`. Label CSS:
  `.vault-heatmap-view .leaf-node__label` in `styles.css` (monospace 9px, halo stroke).
- Layout + zoom: `src/view/components/TreemapViz.tsx`. Zoom is `@visx/zoom` applying a transform
  to a `<g>`, so text scales with zoom today; layout is in a `useMemo` on unzoomed sizes.
- Dense folders collapse on the UNZOOMED layout (`src/viewModel/partitionTreemapNodes.ts`); zoom
  does not expand them. That ceiling and its tile-count bound (~viewport area / 1024) are from
  closed ticket `nid_zxh1nwsmchemmzg2fdwu98y22_e` and stay as they are. Drill-in is the way to
  see a collapsed folder's notes.
- Corner "ago" label decisions: closed tickets `nid_38nug4v7v30e1pe2r4bsrque2_e`,
  `nid_1ld735zqcn0a6kyyqymijaabi_e` (tests in `src/view/utils.test.ts`).
- e2e: specs in `e2e/*.e2e.ts`. The closest model is `e2e/heatmapMobileLayout.e2e.ts` (opens the
  heatmap via `setViewState`, sets the viewport size, collapses sidebars). Seed files via
  `ObsidianHarness.launch({seedFiles})`. `page.screenshot()` is not used in the repo yet but the
  harness exposes a Playwright `Page`. PNGs go to git-ignored `.out/`, never committed.
  See `docs/e2e-testing.md`.

## Constraints

- Wrap by hand: measure, then emit one SVG `<tspan>` per line. Do NOT use `<foreignObject>` + CSS
  wrapping: on iOS, WebKit misplaces foreignObject content under transformed parents, and the zoom
  is a transform.
- Measure with canvas `measureText` (or equivalent real measurement) using the label's actual
  font. Cache results (per string or per character). The line-breaking logic is a small pure class
  that takes the measurer as a parameter, so it is unit-tested with a fake measurer and stays
  obsidian/DOM-free.
- Do not change the treemap layout (still `treemapSquarify`) or the collapse rule.
- Theme-aware styling stays in `styles.css` classes (see the theme-aware decision in `CLAUDE.md`).
- e2e asserts journeys only (e.g. the heatmap renders with the seeded names), no pixel/CSS
  assertions. Screenshots are for human review.

## Non-goals

- **Layout option (slice / dice / slice-dice) — rejected by the owner (2026-10-23).** Band layouts
  turn many-file folders into thin slivers (50 files in 300 px ≈ 6 px each), which is worse in the
  exact case reported. They only help folders with few files, and they would add a persisted
  setting + sanitizer + tests for little value.
- Expanding collapsed folders on zoom.
- Hyphenation or language-aware word breaking.
- Touch interaction: ticket `nid_fx5flv7humtg2d6xamfwprvm5_e`.
