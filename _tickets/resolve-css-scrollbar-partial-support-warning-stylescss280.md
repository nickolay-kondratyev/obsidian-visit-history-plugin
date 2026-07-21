---
id: nid_8l9hoabp8elh3qufjxg07atvn_E
title: "Resolve css-scrollbar partial-support warning (styles.css:280)"
status: open
deps: []
links: []
created_iso: 2026-07-21T01:06:01Z
status_updated_iso: 2026-07-21T01:06:01Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-review, css]
---

Obsidian review: 'Unexpected browser feature "css-scrollbar" is only partially supported by Obsidian 1.4.5' at styles.css:280. Context (styles.css ~276-284):

  .vault-heatmap-view .filter-chips { ... overflow-x: auto; scrollbar-width: none; /* chips scroll on wheel/drag; a bar would break the 42px row */ }
  /* WebKit fallback for scrollbar-width:none ... */
  .vault-heatmap-view .filter-chips::-webkit-scrollbar { ... }

The finding is the `scrollbar-width: none` standard property (partially supported on the flagged Obsidian version). A `::-webkit-scrollbar` fallback already exists. FIX DIRECTION (favor CSS-only, robust, per CLAUDE.md): confirm the visual intent (hidden scrollbar on the horizontally-scrollable filter-chips row) still holds across Obsidian's supported range; if the warning is unavoidable and behavior degrades gracefully (bar just shows), document WHY-inline and treat as accepted — otherwise adjust to a fully-supported approach. Keep the 42px row layout intact.

VERIFY: heatmap filter-chips row still scrolls horizontally without a layout-breaking scrollbar; no regressions.

## Acceptance Criteria

css-scrollbar warning resolved or explicitly documented as accepted with graceful degradation; filter-chips row layout/scroll behavior preserved.

