---
closed_iso: 2026-10-22T17:43:00Z
session_ids: [{"a": "claude", "type": "execution", "id": "b1f48473-2ab7-4a7c-b181-ae094375e7df"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_38nug4v7v30e1pe2r4bsrque2_e
title: "Display timestamp of last visit in the bottom right corner when there is enough space"
status: closed
deps: []
links: []
created_iso: 2026-10-22T17:37:59Z
status_updated_iso: 2026-10-22T17:43:00Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Display timestamp in the right bottom corner in the vault heat map when there is enough space.

I am thinking make it human readable, 

So something like '3d ago' - would be if we are on the order of day+

12h ago if we are in the order of <day.
33m ago if we in the order of <hour. 


We only want this display to appear if there is enough space in the tile, that means there should be enough space for title, then empty line and another line that can be used. So that the title and the timestamp do not appear squished.

## Resolution

Built: every heatmap leaf tile shows its last-visit age in the bottom-right corner when there is room.

- `src/view/utils.ts`
  - `fmtAgo(ts, nowMs)`: `<1m ago` / `33m ago` / `12h ago` / `3d ago`, floored to the largest whole unit. Days never roll up into weeks or years (`400d ago`). Future stamps (clock skew) clamp to `<1m ago`.
  - `cornerLabelFits(w, h, text)`: the tile must be at least 3 lines tall (title + empty line + label, 12px each = 36px) and as wide as the estimated label width (`chars * 5.5px + 2 * 3px` padding).
- `src/view/components/LeafNode.tsx`: renders `<text class="leaf-node__label leaf-node__visit-ago">` right-aligned, 3px in from the bottom-right corner. Not shown when the file was never visited.
- `styles.css`: `.leaf-node__visit-ago` is a slightly dimmer white than the title.
- Tests: `src/view/utils.test.ts` covers the `fmtAgo` unit boundaries and the `cornerLabelFits` limits.

Assumptions made (non-interactive run):
- The label always shows **last visit** (`lastVisitedAt`), whatever heat field is active, as the ticket title says. The tooltip still shows all three timestamps.
- Under a minute shows `<1m ago`. The ticket only specified d/h/m.
- Text width is ESTIMATED (monospace ≈ 0.6em) with no DOM measurement. A theme with a wider monospace font could clip the last character. The upgrade path is `getComputedTextLength`; this is noted in a code comment.
- The age is computed at render time (`Date.now()`), so it refreshes on re-render (hover, data change) and not on a timer. Same behavior as `heatColor`.

Not done: no visual/e2e check in a real Obsidian window. The heatmap has no screenshot e2e. Verified by unit tests, `npm run build`, and `npm run lint` (0 errors).
