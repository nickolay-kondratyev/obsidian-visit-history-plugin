---
id: nid_0x7jjcfyr7xs5t02sv6x90rti_e
title: "Heatmap on mobile: horizontal swipe to pan also opens Obsidian's side drawer"
status: in_progress
deps: []
links: [nid_fx5flv7humtg2d6xamfwprvm5_e]
created_iso: 2026-10-23T23:56:10Z
status_updated_iso: 2026-10-23T23:59:35Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin/.worktree/t-0x7jjcfy
tags: [heatmap, obsidian-mobile]
---

## Goal

On Obsidian mobile (verified on the Android tablet emulator), a horizontal swipe on the heatmap canvas
pans the treemap AND opens Obsidian's left/right side drawer. The next tap only closes the drawer.
So horizontal panning is effectively broken on mobile. This predates the touch work: it was found
while verifying ticket `nid_fx5flv7humtg2d6xamfwprvm5_e`. `touch-action: none` on the canvas
(already in place) does not prevent it. We want a swipe that starts on the heatmap canvas to pan
only.

## Done criteria

- On the Android tablet emulator (`docs/android-tablet-testing.md`, real `adb shell input swipe`):
  a horizontal swipe in either direction that starts on the heatmap canvas pans the treemap and
  does NOT open a side drawer. Record before/after in a "## Verification" section of this ticket.
- Swiping from the screen edge OUTSIDE the heatmap canvas (e.g. over the header or the ribbon area)
  still opens the drawer as normal. Obsidian's own gesture stays intact everywhere else.
- Tap behavior from `nid_fx5flv7humtg2d6xamfwprvm5_e` is unchanged: `e2e/heatmapTouchTap.e2e.ts`
  passes, and a tap on a file still shows the details card on the emulator.
- Desktop mouse behavior is unchanged.
- `npm run build`, `npm run lint` (zero errors), `npm test` and the heatmap e2e specs pass.

## Context

- Canvas + pan/zoom: `src/view/components/TreemapViz.tsx` (`@visx/zoom`, which uses
  `@use-gesture`), the `touch-action: none` rule for the canvas in `styles.css`.
- Obsidian mobile swipe handling is not public API. Find out how it listens (which element, which
  events, capture or bubble phase) before choosing a fix, e.g. by inspecting over raw CDP on the
  emulator. Plausible fix: stop the canvas's touch/pointer events from propagating past the heatmap
  container, registered so it is cleaned up on unload. This only works if Obsidian listens
  below the document in the bubble phase.
- Popout windows: use the element's `ownerDocument`, never the global `document`.

## Constraints

- If there is no robust fix (e.g. Obsidian listens on the document in the capture phase, and only
  monkey-patching Obsidian internals would help), STOP and report the finding with options. Do not
  hack around it.
- Name any undocumented Obsidian behavior you rely on in a code comment, with the Obsidian version
  you verified it on.

## Non-goals

- Changing Obsidian's drawer behavior outside the heatmap.
- The tap-wobble tolerance of the tap filter (a finger moving more than ~3 px counts as a drag).
  Watch for that on a real device first.

## Root cause

Observed over raw CDP (`getEventListeners`) on Obsidian 1.14.4 Android: the drawer swipe is a
BUBBLE-phase `touchstart` listener on `.workspace`. It returns early when any HTMLElement ancestor
of the touch target has `dataset.ignoreSwipe` (Obsidian sets `data-ignore-swipe` on its own tab
headers and leaf resize handles), when the target is an `<audio>`, or when the touched element is a
`<canvas>`. Our svg matched none, so the drawer took the swipe. `touch-action` is irrelevant: the
handler reads raw touch events. Fix: `data-ignore-swipe="true"` on `#viz` (Obsidian's own opt-out;
no stopPropagation, no patching).

## Verification

Android tablet emulator (Obsidian 1.14.4, 2560x1600), real `adb shell input swipe`, state read
over CDP (`leftSplit/rightSplit.collapsed`, treemap `<g>` transform). Screenshots in the lane's
git-ignored `.out/swipe/`.

- Before: canvas swipe right (800,1000 -> 1600,1000) panned (tx 0 -> 146.7) AND opened the left
  drawer (`01-before-fix-swipe-right.png`).
- After: canvas swipe right panned (tx -59 -> 137.7), no drawer (`02-after-fix-swipe-right.png`);
  canvas swipe left (1800,1000 -> 700,1000) panned (tx 137.7 -> -133.7), no drawer
  (`03-after-fix-swipe-left.png`).
- After: swipe over the view header (300,200 -> 1300,200) opened the left drawer
  (`04-after-fix-header-swipe-right-opens-left-drawer.png`); swipe over the heatmap toolbar
  (1800,290 -> 600,290) opened the right drawer (`05-...right-drawer.png`).
- After: tap on `Big touch target.md` docked the details card
  (`06-after-fix-tap-file-shows-card.png`).
- Swipes starting at the very screen edge (x=10 / x=2550) are taken by Android's system back
  gesture (it backgrounded Obsidian) — a system gesture, not affected by this fix.
