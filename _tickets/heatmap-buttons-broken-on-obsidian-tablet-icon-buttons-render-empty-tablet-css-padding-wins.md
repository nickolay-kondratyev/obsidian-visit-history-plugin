---
id: nid_8u6pi2do1vss1yt2hfgc6uicc_e
title: "Heatmap buttons broken on Obsidian tablet: icon buttons render empty (tablet CSS padding wins)"
status: open
deps: []
links: [nid_2sx3if2tus8bc7j3i4oio11b7_e]
created_iso: 2026-10-23T15:56:17Z
status_updated_iso: 2026-10-23T15:56:17Z
type: bug
priority: 2
assignee: nickolaykondratyev
tags: [css, heatmap, obsidian-mobile]
---

## Goal

On Obsidian for tablets (Android), the heatmap view's icon-only header buttons (filter, reset zoom, info, configure) show as empty boxes. That makes the heatmap hard to use on a tablet. Make every heatmap button render as designed on tablets, with no change on desktop.

## Done criteria

- On the Android tablet emulator (`npm run android:setup`, then `npm run android:push-plugin` after the fix; see `docs/android-tablet-testing.md`), the four `.hdr-icon-btn` icons are visible in the heatmap header.
- Measured in the live WebView (CDP `Runtime.evaluate`; how-to in `docs/android-tablet-testing.md`), every `.vault-heatmap-view .hdr-icon-btn svg` has `getBoundingClientRect().width` equal to its CSS size (15px), not 0.
- Measured the same way, no `.vault-heatmap-view button` has the computed padding `4px 20px` coming from Obsidian's tablet rule. Each button gets the padding the plugin's own rule sets.
- The heatmap header and config panel look the same on desktop as before. Check with a before/after screenshot of the heatmap view in desktop Obsidian.

## Context

Root cause, verified 2026-10-23 on Obsidian 1.14.4 for Android (tablet AVD) by reading computed styles over CDP:
- Obsidian's `app.css` has `.is-tablet button:not(.clickable-icon) { padding: var(--size-4-1) var(--size-4-5) }`, which computes to `4px 20px`. Its specificity is (0,2,1).
- The plugin's `.vault-heatmap-view .hdr-icon-btn { padding: 0; width: 28px; ... }` in `styles.css` (around line 235) is only (0,2,0), so it loses, even though the plugin CSS loads later.
- With `width: 28px` and 40px of side padding, the button has no content box left. The flex child `svg.vt-icon` (`styles.css` around line 253, `width: 15px`) shrinks to 0px wide but stays 15px tall.
- The same tablet padding also hits every other button in the view: `.breadcrumb-back`, `.header-btn`, `.seg-opt` (config panel segmented options; "CONTENT SIZE" looks cramped). It does not apply on desktop.
- The icons are inline React SVGs: `src/view/components/icons.tsx` renders them, and `src/view/components/Header.tsx` and `src/view/components/header/FilterGroup.tsx` place them.
- The plugin's generic button reset (`.vault-heatmap-view button`, `styles.css` around lines 96-108) deliberately does not reset padding.

## Constraints

- Fix it in CSS (`styles.css`). Do not branch on `Platform` in TS for styling.
- Avoid `!important`. Win the cascade with specificity, for example `.vault-heatmap-view button.<class>`, which ties at (0,2,1) and wins on source order.
- If you consider adding Obsidian's `clickable-icon` class instead, know that it opts the buttons into Obsidian's own icon-button styling (padding, colour, hover background), which may change the desktop look.
- Make the icon unable to collapse (for example `flex-shrink: 0` on `.vt-icon`), so a future padding change cannot hide it again.
- If you can, check whether Obsidian has a matching `.is-phone` rule. If so, cover phones with the same fix, since the cause is the same.

## Non-goals

- Automated Android tests; that is ticket `nid_2sx3if2tus8bc7j3i4oio11b7_e`.
- Redesigning the header layout for small screens.
