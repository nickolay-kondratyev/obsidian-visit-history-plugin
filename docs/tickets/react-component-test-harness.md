# Evaluate a React component test harness for the heatmap view

**Status**: OPEN (repo-wide gap, re-flagged during `heatmap-filter-ui`, 2026-07-15)

## Problem
No jsdom/@testing-library setup exists, so React component behavior is only
verifiable manually. Growing untested-by-automation surface: panel mutual
exclusion (openPanel), chip add/remove flows, FilterPopover Enter-to-add,
latest-wins content-match effect, drill-down click → segment append,
empty-state rendering.

## Mitigation so far
All non-trivial logic is kept OUT of components in pure viewModel units
(filterVaultTree, FilterTermOps, ContentTermMatcher, folderTrail — all
unit-tested); components stay declarative shells.

## Fix ideas
- Add vitest + jsdom environment + @testing-library/react for
  src/view/**/*.test.tsx only; start with App's filter/nav behavior.
- Weigh dependency cost vs. the "keep the plugin small" rule.
