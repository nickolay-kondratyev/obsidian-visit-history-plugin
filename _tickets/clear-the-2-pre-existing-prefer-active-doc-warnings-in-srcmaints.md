---
id: nid_lvus8y59cn0vr4vjup6xbm5bq_E
title: "Clear the 2 pre-existing prefer-active-doc warnings in src/main.ts"
status: open
deps: []
links: []
created_iso: 2026-07-20T22:00:59Z
status_updated_iso: 2026-07-20T22:00:59Z
type: chore
priority: 3
assignee: CC_fable5_WITH-nickolaykondratyev
tags: [lint, obsidian]
---

`npm run lint` reports 2 non-blocking `obsidianmd/prefer-active-doc` WARNINGS at `src/main.ts:133` and `src/main.ts:137`, on the status-bar body-class toggle:

- `src/main.ts:133` — `document.body.toggleClass(CSS_CLASS_HEATMAP_ACTIVE, heatmapActive)`
- `src/main.ts:137` — `document.body.removeClass(CSS_CLASS_HEATMAP_ACTIVE)`

These pre-date the 2026-07 obsidian-review-bot lint fix (branch `fix-obsidian-lint`) and were deliberately left OUT of that scope: they are warnings (not errors), were NOT in the review bot's failure list, and shipped in 1.0.2. The bot-blocking errors (forbidden `eslint-disable` directives) are already fixed.

The status bar lives in the MAIN Obsidian window, so `activeDocument` (whichever window is active) is NOT the right target — a popout could be active and has no status bar. Use the main-window document instead.

## Design

Replace `document.body` with the MAIN-window document: `this.app.workspace.rootSplit.doc.body` (WorkspaceRoot declares `doc: Document`). MUST confirm `this.app.workspace.rootSplit` is available synchronously during `onload` (the status-bar toggle runs at load time, before layout-ready) — if not guaranteed, defer the initial `updateStatusBarVisibility()` to `onLayoutReady`, or capture the main doc via `this.app.workspace.containerEl.ownerDocument`. Follow the same rootSplit pattern already used in `src/core/init/PluginFactory.ts`.

## Acceptance Criteria

`npm run lint` reports 0 errors AND 0 warnings. Status-bar hide/show behavior when entering/leaving the heatmap view is unchanged (verify manually in Obsidian). `npm test` and `npm run build` stay green.

