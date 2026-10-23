---
id: nid_fx5flv7humtg2d6xamfwprvm5_e
title: "Heatmap touch: tap file = details card with Open, tap folder = drill in"
status: in_progress
deps: [nid_qv6dvik5peosopm9ewks3rkm8_e]
links: [nid_qv6dvik5peosopm9ewks3rkm8_e]
created_iso: 2026-10-23T23:17:24Z
status_updated_iso: 2026-10-23T23:38:15Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin/.worktree/t-fx5flv7h
tags: [heatmap-readability]
---

## Goal

On touch devices (Obsidian mobile/tablet, touchscreen laptops) the heatmap has no hover. The
tooltip only runs on mouse move, and a tap opens the file at once. So a touch user can't see a
note's full name or stats before leaving the heatmap. We want the idiomatic mobile pattern (the
Maps pin pattern): tap to see details, then an explicit Open.

## Done criteria

Behavior on a TOUCH tap (decided per tap from the pointer event's `pointerType`, not per device):
- Tap a file tile: the tile is highlighted as selected and a details card docks at a fixed spot at
  the bottom of the heatmap, NOT at the finger. The card shows the full name (wrapped), the same
  stats as the hover tooltip, and an **Open** button (a touch-sized target).
- Tap **Open**, or tap the selected tile again: the file opens.
- Tap a different file tile: the selection and card move to it.
- Tap empty space: the card closes and nothing is selected.
- Tap a folder (expanded folder area/header or a collapsed dense-folder tile): drill in right
  away, no select step. Any open card closes.
- A pan/drag gesture never counts as a tap: it neither selects, opens, nor drills in.
- A touch tap does not ALSO trigger the browser's imitation mouse events afterwards (no tooltip
  flash, no file open from the synthetic click).

Mouse behavior is unchanged: hover shows the tooltip, a click opens the file or drills in.

Tests:
- The tap rules (selection state transitions above) live in a small pure, obsidian/DOM-free
  unit with unit tests for every bullet above, including mouse input leaving behavior unchanged.
- One e2e journey drives real touch input on desktop Obsidian over CDP (e.g.
  `Input.dispatchTouchEvent` through a CDP session; Playwright `hasTouch` can't be set after
  `connectOverCDP`): tap a file → card visible → tap Open → that file is the active file. If
  real touch input turns out impossible in the harness, report it as a judgement call instead of
  faking it with mouse events.
- `npm run build`, `npm run lint` (zero errors) and `npm test` pass. Touched e2e specs pass.

## Context

- Hover/tooltip + click handling: `src/view/components/TreemapViz.tsx` (`handleLeafMove`,
  `handleLeafLeave`, `handleFolderNodeClick`, tooltip positioning inside `#viz`), tooltip content:
  `src/view/components/Tooltip.tsx`. Leaf events: `src/view/components/LeafNode.tsx`
  (`onMouseMove`/`onMouseLeave`/`onClick`). Folder clicks: `src/view/components/FolderNode.tsx`,
  `src/view/components/CollapsedFolderNode.tsx`. Pan/zoom: `@visx/zoom` in `TreemapViz.tsx`.
- Label wrapping/measuring from ticket `nid_qv6dvik5peosopm9ewks3rkm8_e` (dependency) can be
  reused for the card's full name if useful. The card itself is HTML, so CSS wrapping is fine.
- Existing touch conventions: the embed inline icon is hover-only on desktop and always visible on
  touch (closed `nid_mrd8gbvxgxbkopite8muxzrnd_e`). Tablet CSS can override plugin button styling,
  so fix it without changing desktop (closed `nid_8u6pi2do1vss1yt2hfgc6uicc_e`,
  `nid_7n2lvhgesln25nxooiauewd8c_e`; Obsidian mobile `--input-height` 44 px is a fine touch target).
- e2e: `docs/e2e-testing.md`, model spec `e2e/heatmapMobileLayout.e2e.ts`. Specs that click must
  call `h.trustVaultAuthor()`.
- Manual check on the Android emulator is optional: `docs/android-tablet-testing.md`,
  `npm run android:push-plugin`. Automated Android tests are a separate open ticket
  (`nid_2sx3if2tus8bc7j3i4oio11b7_e`). Don't do them here.

## Constraints

- Owner decisions (2026-10-23): tap-to-select + docked card with Open; second tap on the same tile
  also opens; folders (incl. collapsed) drill in on one tap; long-press is NOT used for preview
  (in Obsidian mobile long-press means context menu).
- Only `VaultTreemapView.tsx` imports `obsidian`. The card is a plain React component styled in
  `styles.css` (theme-aware vars).

## Non-goals

- Long-press file context menu on tiles (open in new tab, reveal in explorer). That's a possible
  separate follow-up, not part of this ticket.
- Esc-key dismissal of header popovers.
- Changing desktop mouse behavior.
