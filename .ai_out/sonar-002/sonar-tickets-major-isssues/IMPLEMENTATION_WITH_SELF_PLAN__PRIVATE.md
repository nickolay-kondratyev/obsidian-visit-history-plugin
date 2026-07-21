# sonar-002 PRIVATE state

## Task
SonarQube MAJOR typescript:S9011 — add explicit `type` attr to flagged `<button>`s.
React default button type is `submit`; be explicit. Use `type="button"` (none submit forms).

## Status: COMPLETE
All edits applied, lint + tests green. NOT committed (top-level agent commits).
No changelog written (top-level agent owns it).

## Changes made (all added `type="button"`)
Verified via `grep -n "<button"` — found exactly 8, all handled:
1. Header.tsx breadcrumb-back — single-line, inserted `type="button" ` after `<button `.
2. Header.tsx field toggle — multi-line, inserted `type="button"` line after `<button`.
3. Header.tsx reset-zoom (hdr-icon-btn / onResetZoom) — multi-line.
4. Header.tsx info toggle (openPanel === 'info') — multi-line.
5. Header.tsx config toggle (openPanel === 'config') — multi-line.
6. TreemapViz.tsx clear-filters (header-btn / onClearFilters) — multi-line.
7. FilterGroup.tsx filter toggle (filterOpen active) — multi-line.
8. FilterGroup.tsx chip remove X (filter-chip-x / onRemoveTerm) — multi-line.

## Verification results
- lint: exit 0; 0 errors, 2 warnings. Warnings PRE-EXISTING & unrelated:
  src/main.ts:133,137 obsidianmd/prefer-active-doc. Output: .tmp/lint.out
- test: exit 0; 37 files / 358 tests passed. Output: .tmp/test.out

## If cloning to redo
Nothing left. Re-run `grep -rn "<button" src/view/components/Header.tsx \
src/view/components/TreemapViz.tsx src/view/components/header/FilterGroup.tsx`
— every match should already have `type="button"`.
