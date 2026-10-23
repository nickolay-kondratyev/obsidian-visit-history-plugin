---
id: nid_0x7jjcfyr7xs5t02sv6x90rti_e
title: "Heatmap on mobile: horizontal swipe to pan also opens Obsidian's side drawer"
status: open
deps: []
links: [nid_fx5flv7humtg2d6xamfwprvm5_e]
created_iso: 2026-10-23T23:56:10Z
status_updated_iso: 2026-10-23T23:56:10Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
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
