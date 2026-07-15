# CLARIFICATION — Heatmap Filter UI (resolved with HUMAN)

## Task (original)
1. Add filtering ability UI to the vault heatmap.
2. Collapse non-actionable info in the top row into an INFO icon (popover on click) so the top row concentrates on actions.
3. Config becomes an icon; add a filter icon. Added filter terms are visible in the top row, grouped, filter icon left-most of the group.

## Resolved decisions (HUMAN-approved)

1. **INFO icon collapses**: title ("vault heatmap") + stats (files/folders/size) + legend (color key) → all go into ⓘ popover. (A separate view title row already exists, so in-header title is redundant.)
2. **Field indicator stays in header but becomes ACTIONABLE**: clicking it lets the user choose between `created / modified / visited` — reuse the SAME component used in the config panel for field selection (DRY).
3. **Two separate filter term kinds**, visually distinguishable (use frontend design memory `${MY_DEEP_MEM}/my-frontend-design.md`):
   - **Path terms** — case-insensitive substring match against the file's full path (matches folder names too).
   - **Content terms** — match against file CONTENT (text inside the files).
4. **Multiple terms = OR** (include-list; file shown if it matches ANY term). Include-only — no exclusion syntax this iteration (follow-up ticket candidate).
5. **Persistence**: filter terms persist in `HeatmapConfig` (data.json), sticky across restarts AND across folder drill-down navigation.
6. **UI shape** (approved to try):
   - Header (left→right): `[breadcrumb] [🔍 filter-group: icon + term chips ✕] [field-selector] [spacer] [ⓘ info] [⚙ config icon]`
   - Filter icon click → popover (like ConfigPanel pattern) with input(s) to add terms (Enter to add); terms render as removable chips in the header group; filter icon left-most.
   - Icons: inline SVG/Unicode only — React view stays Obsidian-agnostic (no `setIcon`).
7. **Scope**: filtering applies to the currently viewed root (vault or drilled-in folder); stats + legend reflect the FILTERED view.

## Complexity flag for PLANNER
**Content-term filtering requires file content access.** The React view is Obsidian-agnostic and `VaultNode` carries no content. Content search must happen at the Obsidian boundary (`VaultTreemapView` / a service injected via PluginFactory, e.g. `Vault.cachedRead`), with results passed into React as data/callbacks. Performance on large vaults must be considered (caching, async, debounce). PLANNER must design this seam explicitly.
