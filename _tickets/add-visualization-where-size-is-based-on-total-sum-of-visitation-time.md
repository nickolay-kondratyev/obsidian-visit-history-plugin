---
closed_iso: 2026-10-22T19:42:17Z
session_ids: [{"a": "claude", "type": "execution", "id": "cfa2f73d-9e68-4aaf-ab4b-a3221eca3c2b"}, {"a": "claude", "type": "review", "id": "932e447c-97cd-46ba-b970-8f28c4e39643"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_8uor1go1v8imlhz953kbhiip4_e
title: "Add visualization where size is based on total sum of visitation time."
status: closed
deps: []
links: []
created_iso: 2026-10-22T18:57:10Z
status_updated_iso: 2026-10-22T19:42:17Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

GOAL: allow the sizing of heatmap to be determined by the visitation time of the notes.

Right now the size is based on the content of the notes in settings and there is a 'scale factor' that implies size.

Lets add another setting in the settings and make it very clear that its grouped together, where we get to choose based on what the size of the squares is determined. Where we get to choose whether it is chosen based on size of the note OR based on the visitation time. We can still have the scale factors for both CONTENT SIZE and VISITATION time but the visitation time scaling should start with 1X for everything, AND we MUST make sure that CONTENT_SIZE and VISITATION_SIZE scaling are saved SEPARATELY.

WHEN notes do not have visitation time they would have size 0 and hence when notes get hidden we will want to have a neat banner dispalyed in the top header row (where the icons are) that communicates something along the lines of 'X amount of notes are hidden due to not having visitation history'. 

With this when notes are combined together due to having too many their sizes should also be combined depending on the size settting and the scaling factors of that size setting.

## Clarifications (agent-resolved 2026-10-22 — override any you disagree with)

Status: CLEAR TO PROCEED — no blocking human decisions.

- **"Settings" = the heatmap config panel** (gear icon in the heatmap header), where the "Scale factors" sliders already live. NOT the Obsidian Settings → Visit History tab.
- **Grouping in the panel**: one "Size" section = a `SegmentedToggle` [Content size | Visit time] with that mode's per-type scale sliders directly under it. Only the ACTIVE mode's sliders are shown; the other mode's values stay saved, untouched.
- **Separate persistence**: `HeatmapConfig` gets a `sizeBy` union (`'contentSize' | 'visitTime'`, default `contentSize` = today's behavior), a per-mode size curve (see below), plus a second per-type scale map for visit time (md/canvas/excalidraw all `{value: 1, min: 0.05, max: 2}`). Existing saved content scales must survive the upgrade (sanitizer reads the current `scales` key).
- **Visit time = `VisitStats.totalFocusMs`**: closed sessions only, summed across ALL users/devices (same as the existing "last visited" heat field — owner decision). Needs plumbing: `VaultUtil.getTrackedFiles` → `FileTimeMetadata` → `VaultNode` (only `lastVisitMs` gets there today).
- **Size curve: Linear | Sqrt | Log, for BOTH sizing modes** (human-requested 2026-10-22). Without it, a few heavily visited notes (e.g. daily notes) or huge files take most of the space and push the rest into collapsed tiles.
  - Each mode saves its own curve, like it saves its own scales. Default = `sqrt` for BOTH modes (human decision).
  - BEHAVIOR CHANGE: the content-size view is linear today. Existing users get `sqrt` on upgrade (a missing curve field sanitizes to the default), so their heatmap will look flatter until they pick Linear.
  - Panel: a small `SegmentedToggle` [Linear | Sqrt | Log] inside the "Size" section, under the size-by toggle, applying to the active mode.
  - Formula: linear = `raw × typeScale`; sqrt = `sqrt(raw) × typeScale`; log = `log1p(raw) × typeScale`. Raw = bytes, or focus SECONDS (not ms, so a few seconds of focus doesn't count as thousands of units). The type scale multiplies AFTER the curve, so ×0.3 still means "30% of the area".
  - Rough spread for a 1 KB vs 1 MB note: linear ≈ 1000×, sqrt ≈ 32×, log ≈ 2×.
  - Drop the integer rounding (`Math.round`) in the treemap value: sqrt/log values are small, so rounding would erase the differences. d3 works fine with fractional sums.
  - 0 visit time → 0 under every curve → still hidden (banner logic unchanged). Content mode keeps a small positive floor, so 0-byte notes still show under every curve.
  - Collapsed folders sum their files' already-curved values, which is what we want: the folder area matches the sum of the tiles it replaces.
- **Hidden notes**: in visit-time mode, notes with 0 focus time are LEFT OUT of the layout (not drawn as 0-area tiles). Folders left empty disappear, the same way filters remove them. Content mode keeps today's 1-byte floor, so nothing is hidden there.
- **Banner** (header row, next to the icons): only shows in visit-time mode when count > 0. Short text, e.g. `12 notes hidden · no visit history`, with the full sentence as the hover tooltip. The count covers notes in the CURRENT view (after drill-down, `_archive` pruning, and filters), so it matches what the user is looking at.
- **All-hidden case**: if every note in the view has no visit time, show an empty state that explains why, with a "Size by content" button (same style as the filter empty state's clear-filters button).
- **Collapsed folders**: already correct. d3 `hierarchy.sum` makes a collapsed tile's area the sum of its files' values in the active mode, so no extra code is needed beyond a test. Its file count should skip hidden notes.
- **Header stats / tooltip**: info-popover file count = visible files. Tooltip shows a "visited for" total-time row, and in visit-time mode the effective size (time × scale) instead of the bytes × scale line.
- **Accepted gaps (noted, not fixed here)**:
  - Raw `.excalidraw` files never get a doc id, so they never have visit time. They're always hidden in visit-time mode and counted in the banner.
  - Visit-time sizes refresh when the view refreshes, not live per session close. The "last visited" field has the same lag.
- **Docs**: update `docs/` (heatmap view) and the CLAUDE.md heatmap bullet in the same change.

## Resolution (2026-10-22)

Built as specified above. Commits `6b6bad9` (plumbing), `c861b4c` (config + sizing + view), `28e8d1d` (docs), `227cf2a` (review fixes).

- **Plumbing**: `VisitStats.totalFocusMs` → `FileTimeMetadata.totalFocusMs` (`VaultUtil.getTrackedFiles`) → `VaultNode.totalFocusMs` (`buildVaultTree`).
- **Config** (`src/viewModel/heatmapConfig.ts`): top-level `scales` REPLACED by `sizeBy: 'contentSize' | 'visitTime'` + `sizing: Record<SizeBy, { curve, scales }>`, so each mode's curve and scales are saved separately. Upgrade: when `sizing.contentSize.scales` is missing, the sanitizer reads the legacy top-level `scales` (marked for cleanup after 2027-April). A missing curve becomes `sqrt` (the behavior change noted above).
- **Sizing** (new `src/viewModel/tileSize.ts`, pure, obsidian-free): `tileValue` = `curve(raw) × typeScale`, not rounded. Raw = bytes with a 1-byte floor applied BEFORE the curve, or focus seconds. `hideUnvisitedFiles` (visit-time mode only) removes leaves whose focus time is not > 0 (NaN and negative count as unvisited) and drops folders left empty. It runs in `TreemapViz` after `_archive` pruning and filters, and returns the hidden count.
- **View**:
  - `ConfigPanel` has one "Size" section: size-by toggle, curve toggle, and only the active mode's sliders.
  - `Header` shows the banner `N notes hidden · no visit history` (full sentence on hover; visit-time mode only, `.hdr-hidden-banner` in `styles.css`).
  - `TreemapViz` shows a "no visit history" empty state with a "size by content" button. It takes priority over the filter empty state, and the two never show together.
  - `Tooltip` has a new "visited for" row (`fmtDuration` in `view/utils.ts`). The old "effective" row is renamed "tile size" and shows the real computation, e.g. `sqrt(2.0 KB) ×0.30`. The old `bytes × scale` text was wrong under sqrt/log.
- **Collapsed folders**: no extra code. A d3 test in `tileSize.test.ts` checks that a folder's value equals the sum of its files' curved values.
- **Docs**: `docs/heatmap-view.md` ("Tile sizing" section), `docs/architecture.md`, CLAUDE.md/AGENTS.md.
- **Checks**: 595/595 unit tests pass, lint has 0 errors (1 pre-existing `setWarning` warning), build passes. e2e was not run and the UI was not checked in a real Obsidian.
- **Gaps**:
  - No React component tests (the repo has none). The "write only the active mode" merge in `ConfigPanel` is covered only by type checks.
  - The accepted gaps above still apply: raw `.excalidraw` files are always hidden in visit-time mode, and visit times refresh only on view refresh.
