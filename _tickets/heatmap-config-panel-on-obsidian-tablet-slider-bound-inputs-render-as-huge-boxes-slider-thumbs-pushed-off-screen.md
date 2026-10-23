---
id: nid_7n2lvhgesln25nxooiauewd8c_e
title: "Heatmap config panel on Obsidian tablet: slider bound inputs render as huge boxes, slider thumbs pushed off-screen"
status: open
deps: []
links: [nid_8u6pi2do1vss1yt2hfgc6uicc_e]
created_iso: 2026-10-23T17:06:04Z
status_updated_iso: 2026-10-23T17:06:04Z
type: bug
priority: 2
assignee: nickolaykondratyev
tags: [css, heatmap, obsidian-mobile]
---

## Goal

On Obsidian for tablets (Android), the heatmap config panel's range sliders are hard to use. The editable min/max bound inputs (`.bound-input`, rendered by `src/view/components/ConfigPanel/BoundInput.tsx` inside `RangeSlider.tsx`) show as large full-width white boxes (about 70px tall). They push the slider track and thumbs to the right edge, where the thumbs are mostly cut off. Make the sliders and their bound inputs look and work on tablets as they do on desktop, with no change on desktop.

Found while verifying ticket `nid_8u6pi2do1vss1yt2hfgc6uicc_e` (tablet button padding). Evidence: the after screenshot of that ticket's lane, `.worktree/t-8u6pi2do/.out/tablet-after.png` (config panel on the right: "hot / new" with input "1", "cold / old" with input "7"). That lane is removed after merge, so re-take the screenshot if the file is gone.

## Done criteria

- On the Android tablet emulator (`npm run android:setup`, then `npm run android:push-plugin`; see `docs/android-tablet-testing.md`), each slider row shows its bound inputs at the plugin's designed size, with the slider track and both thumbs fully visible.
- Measured in the live WebView (CDP `Runtime.evaluate`), no computed style on `.vault-heatmap-view input` comes from an Obsidian `.is-tablet` / `.is-mobile` / `.is-phone` input rule where the plugin's own rule sets that property (check height, padding, width, font-size).
- Desktop look unchanged: compare computed styles of the inputs before vs after in desktop Obsidian (the e2e harness can capture them with a throwaway spec; do not commit CSS/look assertions).

## Context

- Likely the same class of root cause as `nid_8u6pi2do1vss1yt2hfgc6uicc_e`: an Obsidian mobile/tablet rule on `input` (e.g. a larger `--input-height`, padding or width) at higher specificity than the plugin's `.vault-heatmap-view .bound-input` (`styles.css` around line 690) and `.slider-track-row input[type="range"]` (around line 684). Not yet verified: read the computed styles and matched rules over CDP first.
- Also check `.filter-pop-input` (`src/view/components/header/FilterPopover.tsx`) and the radio inputs in `RadioGroup.tsx` for the same problem.
- The fix for buttons used `.vault-heatmap-view button.<class>` to tie Obsidian's (0,2,1) rule and win on source order. See the Styling section of `docs/heatmap-view.md`.

## Constraints

- CSS only (`styles.css`); no `Platform` branching in TS; no `!important`.

## Non-goals

- Redesigning the config panel for small screens.
- Automated Android tests (ticket `nid_2sx3if2tus8bc7j3i4oio11b7_e`).

