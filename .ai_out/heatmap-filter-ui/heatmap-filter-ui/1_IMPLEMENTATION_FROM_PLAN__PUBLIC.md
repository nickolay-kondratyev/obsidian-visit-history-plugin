# IMPLEMENTATION (from plan) — Heatmap Filter UI

> Role: IMPLEMENTATION. Executed `DETAILED_PLANNING__PUBLIC.md` (incl. both
> [PLAN_REVIEWER] inline fixes). Branch `heatmap-filter-ui`, commits
> `87404e7..9be8e9e` (5 milestone commits).

## Verification results (actual numbers)

| Gate | Result |
|---|---|
| `npm test` (vitest) | **333 passed / 0 failed** (39 files; was 325/37 pre-change — +8 test files/cases net across sanitizer, filterVaultTree, FilterTermOps, ContentTermMatcher, VaultUtil) |
| `npm run lint` | **0 errors** (2 pre-existing warnings in `main.ts` — `obsidianmd/prefer-active-doc`, untouched) |
| `npm run build` | clean (`tsc -noEmit` + esbuild production) |

Dev-env note: shell shadows `node`/`npm` with a broken nvm shim (existing
ticket `docs/tickets/dev-env-broken-nvm-node-shim.md`); all gates run via
`/usr/local/bin/npm`.

## What was implemented (per phase / commit)

### 1. Config model + pure tree filter (`87404e7`)
- `src/viewModel/heatmapConfig.ts`: `FILTER_TERM_KINDS`/`FilterTermKind`/`FilterTerm`;
  `HeatmapConfig.filterTerms` (default `[]`); `sanitizeFilterTerms` (non-array → `[]`,
  known kind + trimmed non-empty string text, per-kind case-insensitive dedupe → first wins).
- NEW `src/viewModel/filterVaultTree.ts`: `HeatmapTreeFilter` (`pathTerms` +
  `contentMatchedPaths: ReadonlySet<string> | undefined`), `isFilterActive`,
  `filterVaultTree` — pure, identity fast-path when inactive, prunes emptied folders,
  root always survives. Mirrors `pruneArchiveFolders`.
- NEW `src/viewModel/FilterTermOps.ts`: `add` (trim + ci-dedupe; returns SAME
  reference on no-op), `remove`, `textsOfKind` — keeps term normalization out of React.
- Tests: `heatmapConfig.test.ts` extended (AC1–AC5), NEW `filterVaultTree.test.ts`
  (AC6–AC13 + isFilterActive), NEW `FilterTermOps.test.ts`.

### 2. Content matcher seam (`47d6e17`)
- `src/core/util/vault/VaultUtil.ts`: NEW `getTrackedTFiles(): TFile[]` (sync);
  `getTrackedFiles()` refactored onto it (AC19; NEW `VaultUtil.test.ts`).
- NEW `src/viewModel/ContentTermMatcher.ts`: interface + `ContentTermMatcherDefault`
  (lowercased terms, empty → empty set with NO reads, `cachedRead` per tracked file
  via `Promise.all`, early-exit per file, read failure → `console.error` + non-match).
  No `obsidian` import at all (TFile flows through inference).
- Wired: `PluginFactory.contentTermMatcher` → `VaultTreemapView` → `App` prop.
- Test support: `FakeVaultUtil.getTrackedTFiles`, `FakeNoteFileUtil.cachedReadCallCount`.
- Tests: NEW `ContentTermMatcher.test.ts` (AC14–AC18).

### 3. Path-based drill-down (`04541ec`) — the correctness prerequisite
- `App`: `navStack: VaultNode[]` → `folderSegments: string[]`; `trail`/`currentRoot`/
  `breadcrumb`/`showArchived` derived per render via `findFolderTrail` against
  canonical `data`.
- `FolderNode` passes its `HierarchyRectangularNode`; `TreemapViz` maps it to
  root-RELATIVE segments (`d.ancestors().reverse().slice(1)`); `App.handleFolderClick`
  APPENDS per the [PLAN_REVIEWER] fix.
- **Small deviation (safer than plan):** appends to `trail.map(n => n.name)` (the
  RESOLVED trail) instead of raw `prev` segments — identical whenever the path
  resolves (the normal case), but a stale unresolvable path can't poison the next
  click (trail is `[]` then, so the click resolves from vault root). `handleBack`
  likewise pops the resolved trail.
- TRANSPARENT behavior changes (plan-called-out, approved): deep-folder click now
  records the full trail (back = one level at a time; breadcrumb = true full path);
  vault refresh re-resolves instead of showing a stale subtree.

### 4+5. Header rework + filter UI (`db4492e`, one commit — components interleave)
- `view/constants.ts`: `FIELD_OPTIONS`/`HeatFieldOption` extracted; `HeatmapOptions`
  imports it (DRY).
- `Header.tsx` rebuilt (actions only): breadcrumb · `FilterGroup` · field-selector
  button (`.header-btn`, heatmap mode only, `field: <label> ▾`) · spacer · ⓘ · ⚙
  (icon-only). Exports `HeaderPanel` union. Title/stats/legend removed from the row.
- NEW `view/components/header/`: `FilterGroup.tsx` (🔍 trigger left-most + chips:
  `/`+blue tint = path, `≡`+orange tint = content, plus `title` — never color alone;
  ✕ with `aria-label`), `FilterPopover.tsx` (SegmentedToggle kind + Enter-to-add
  input, stays open, per-kind hint; draft state local), `FieldPopover.tsx` (SAME
  `RadioGroup` + `FIELD_OPTIONS` as the config panel), `InfoPopover.tsx` (title +
  stats + `Legend` reused as-is).
- `App`: single `openPanel: HeaderPanel | null` (mutual exclusion; replaces
  `configOpen`); popovers rendered as `#header` SIBLINGS (open-class pattern,
  `.hdr-pop--left`/`--right` CSS anchors); `addFilterTerm`/`removeFilterTerm` via
  `FilterTermOps` + `updateConfig` (persistence for free); content-match effect —
  latest-wins cleanup flag, `undefined` = inactive, EMPTY set until first
  resolution, deps = content-term key AND `data` AND matcher ([PLAN_REVIEWER] fix).
  Content terms keyed as a `'\u0000'`-joined string so adding a PATH term doesn't
  re-trigger the vault scan.
- `TreemapViz`: `filter` prop; `treeRoot = filterVaultTree(showArchived ? root :
  pruneArchiveFolders(root), filter)`; centered "No files match the current filters"
  empty-state (only when a filter is active).
- **Necessary addition beyond plan text:** `leaves: root.leaves().filter(d =>
  !d.data.children)` — d3's `leaves()` returns a CHILDLESS ROOT as its own leaf, so
  a filter that empties the tree would have rendered the root folder as a file cell
  (and the empty-state check `leaves.length === 0` would never fire).
- `styles.css`: `.hdr-icon-btn`, `.filter-group` (only shrinkable header child;
  chips row `overflow-x: auto`), `.filter-chip*` (kind tints echo md/canvas palette),
  `.hdr-pop*` (config-panel recipe), `.filter-pop-input/-hint`, `.viz-empty-msg`,
  first-child separator strip, info-popover stat stacking. Removed now-dead `#title`
  and `.ts-indicator` rules. All show/hide/hover CSS-only.

### 6. Docs + tickets (`9be8e9e`)
- `CLAUDE.md` (symlink → `AGENTS.md`): arch map entries + two new key-decision
  bullets (filtering, path-based nav + single openPanel).
- `docs/heatmap-view.md`: new "Filtering" section, nav + component tree updated.
- NEW tickets: `heatmap-filter-exclusion-terms.md`,
  `heatmap-content-match-performance.md`, `heatmap-popover-dismissal.md`,
  `react-component-test-harness.md`.

## Deviations from plan (all with rationale, none change direction)
1. `handleFolderClick`/`handleBack` operate on the RESOLVED trail instead of raw
   `prev` segments (§ Phase 3 above) — strictly safer superset of the
   [PLAN_REVIEWER] append fix.
2. Childless-root `leaves()` guard in TreemapViz — required for the planned
   empty-state to work at all (see § Phase 4+5).
3. `FilterTermOps` is a new small viewModel class not named in the plan's file
   list — the plan required add-time normalization AND that such logic live in
   viewModel (§5); mirrors the existing `BoundedValueOps` pattern.
4. Phases 4 and 5 landed as one commit (their component code interleaves in
   Header/App); each still passed the full gate.

## For reviewers to scrutinize
- React-only behavior is manual-verify by design (no harness — ticketed):
  panel mutual exclusion, chip flows, latest-wins effect, drill append,
  empty-state, popover anchoring with long breadcrumbs/many chips.
- MINOR plan-review note #3 accepted as-is: with persisted content-only terms,
  mount briefly shows the empty-state until the first scan resolves.
- Chip tint colors are fixed-hex rgba (matching the existing fixed type palette)
  — verify legibility in light themes (the whole view already uses fixed type hexes).
- `CONTENT_TERMS_KEY_SEP = '\u0000'` — key-encoding trick for effect deps; terms
  are trimmed non-empty UI strings so NUL cannot occur.

## #QUESTION_FOR_HUMAN:
None blocking. Carried forward (non-blocking, already recommended "yes" by
PLANNER/PLAN_REVIEWER): (a) v1 content search re-reads tracked files per
content-term change (ticketed); (b) nav behavior changes listed in § Phase 3.
