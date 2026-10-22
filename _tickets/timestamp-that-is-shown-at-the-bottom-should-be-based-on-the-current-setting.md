---
closed_iso: 2026-10-22T18:20:26Z
session_ids: [{"a": "claude", "type": "execution", "id": "fbc687da-49f0-4295-acbf-8e0742a46f49"}, {"a": "claude", "type": "review", "id": "d6f9e559-4bdf-43e7-83f6-e5c821e4003e"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_1ld735zqcn0a6kyyqymijaabi_e
title: "timestamp that is shown at the bottom should be based on the current setting"
status: closed
deps: []
links: []
created_iso: 2026-10-22T18:03:02Z
status_updated_iso: 2026-10-22T18:20:26Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

We have recently added an optional timestamp that is shown if there is enough space in the heat map.

However, right now it always shows the visitation history timestamp while it should show the timstamp of the current 'timestamp' field that we are using for visualization: created, modified, visited.
## Resolution

The bottom-right in-tile age label on heatmap leaf tiles now shows the age of the **active timestamp field** (created / modified / visited), not always last-visit.

- `src/view/utils.ts` — new pure `leafFieldAgo(leaf, field, nowMs)`: `fmtAgo` of `leaf[field]`, `undefined` when that stamp is missing (label hidden).
- `src/view/components/LeafNode.tsx` — uses `leafFieldAgo(d.data, field, …)`; CSS class renamed `leaf-node__visit-ago` → `leaf-node__field-ago` (`styles.css`).
- Tests: `src/view/utils.test.ts` › `leafFieldAgo` (one per field + missing stamp).
- Docs: `docs/heatmap-view.md` LeafNode line updated.

Assumption (agent decision): the label follows the active field in **both** color modes (heatmap and type). The field setting is kept while in type mode, so this stays consistent and avoids a mode-dependent special case.

## Notes

**2026-10-22T18:21:03Z**

__READY_AS_IS__: small correct change (label follows active HeatField via tested leafFieldAgo); build, lint (0 errors), 515 tests pass; no fixes needed
