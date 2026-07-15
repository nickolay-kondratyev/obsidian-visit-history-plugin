# PLANNER private memory — heatmap-filter-ui (rehydration notes)

Status: DETAILED_PLANNING__PUBLIC.md written (v1, complete). No blocking human questions; one non-blocking cost-model confirm embedded (#QUESTION_FOR_HUMAN item 1).

## What I verified in code (so a future me doesn't re-read everything)

- `App.tsx`: owns `config` (from `configStore.load()`), `configOpen`, `stats`, `navStack: VaultNode[]`, `currentRoot: VaultNode|null`. `updateConfig(partial)` merges + saves. Seeding via `findFolderTrail(data, initialFolderPath)`.
- `Header.tsx`: `#title`, breadcrumb (back btn + path), `.stats` (3 spans), `.ts-indicator` (heatmap mode only), spacer, `<Legend>`, `⚙ config` `.header-btn`. Pure presentational.
- `ConfigPanel/index.tsx`: `#config` + `.open` CSS pattern; uses `SegmentedToggle`, `HeatmapOptions` (which builds `FIELD_OPTIONS` locally from HEAT_FIELDS/FIELD_LABELS/FIELD_SUBS and uses `RadioGroup`), `RangeSlider`.
- `TreemapViz.tsx:132`: `treeRoot = showArchived ? root : pruneArchiveFolders(root)` useMemo; stats bubble from layout (`leaves`/`folders`) via `onStatsChange` — so filtering inside this memo automatically fixes stats. `FolderNode` has `d: HierarchyRectangularNode` and calls `onClick(d.data)` (line ~34) — change to pass `d`.
- `VaultNode`: folders have only `name` (no `path`!); leaves have `path/type/size/createdAt/lastModifiedAt/lastVisitedAt(null-able)`.
- Visited-field sourcing CONFIRMED: `VaultUtilDefault.getTrackedFiles()` → `lastVisitProvider.getLastVisitStamp(f)` → `timeMetadata.visitedMs` → `buildVaultTree` → `lastVisitedAt`. Field selector = pure config change, zero new plumbing.
- `NoteFileUtil.cachedRead(file: TFile)` exists; `FakeNoteFileUtil`, `FakeVaultUtil` (testSupport/fakes.ts line 7), `makeTFile` exist.
- `PluginFactory`: has `vaultUtil` field; `noteFileUtil` is a LOCAL const in ctor (available for wiring matcher). `heatmapConfigStore` precedent for exposing view deps.
- `FileOpener.ts` precedent: interface + Obsidian impl in ONE viewModel file → I mirrored for `ContentTermMatcher` (impl depends on core interfaces only, even cleaner).
- CSS: `#header` overflow:hidden (popovers MUST be siblings, not children); `.breadcrumb` is the grouped-with-left-border template; `#config` at top:42px right:0 width:236 display:none/.open.
- Sanitizer style: per-field fallback, `oneOf` helper, existing tests use GIVEN/WHEN/THEN, `toEqual(DEFAULT...)`.
- `findFolderTrail(root, 'A/B')` walks children by name segments, returns trail or null. Already tested.
- No React test harness (no jsdom/@testing-library). All logic must be in viewModel.

## Key decisions + rationale (defend these in review)

1. **Content seam = Option A** (matcher service prop → App effect → ReadonlySet<string> → pure filterVaultTree). Rejected B (host-side filtering: terms live in App-owned config → inversion loop) and C (content index at build: reads whole vault on every refresh).
2. **`contentMatchedPaths: ReadonlySet<string> | undefined`** — `undefined` = content filtering INACTIVE (distinct from empty set = active-but-nothing-matches/unresolved). During in-flight: keep previous set; first activation: empty set (monotonic fill, no everything-flash). Latest-wins via effect cleanup flag.
3. **Canonical drill-down refactor (Phase 3) is REQUIRED**, not gold-plating: currentRoot today stores nodes from PRUNED COPIES; with filters, removing a term while drilled-in could never restore files (copy lacks them). Chose path-segments state + derived trail (`findFolderTrail`) over click-time-only canonicalization because it also fixes stale-tree-after-refresh and is barely more code. Side effects (CALLED OUT in plan §2.3): deep-click now records full trail (back walks levels; breadcrumb shows TRUE path — today it's partial/wrong after deep click), and isWithinArchive becomes accurate for deep clicks.
4. **Filter application point = TreemapViz treeRoot memo** (after pruneArchiveFolders), NOT App: minimal diff, follows established pattern, stats auto-correct. App passes a `HeatmapTreeFilter` object down.
5. **Single `openPanel` state** ('config'|'filter'|'field'|'info'|null) — mutual exclusion lets popovers share CSS anchors (left:14px for filter+field, right:0 for info). CSS-only anchoring chosen over measured-left JS (CLAUDE.md favor-CSS rule); noted measured anchor as polish.
6. **No debounce needed**: terms change on discrete Enter/✕ actions only. No per-keystroke filtering (scope exclusion).
7. **`VaultUtil.getTrackedTFiles(): TFile[]`** added (sync, cheap) so matcher doesn't pay last-visit/doc-id resolution of `getTrackedFiles()`; getTrackedFiles refactored onto it (DRY).
8. **FIELD_OPTIONS extraction** to view/constants.ts = the DRY move enabling RadioGroup reuse in FieldPopover (requirement #3 "same component").
9. Icons: Unicode 🔍/ⓘ/⚙ per approved sketch + existing ⚙/← precedent. Chip kind distinguishers: `/` prefix (path) vs `≡` prefix (content) + different tint + title — never color alone (design memory).
10. Kind-being-added toggle is LOCAL state in FilterPopover (ephemeral UI state, fine outside App).
11. Dedupe/trim happens at add-time in App AND in sanitizer (boundary backstop). Dedupe per (kind, lowercased text); same text in both kinds allowed (AC5).
12. No term-count cap (KISS; chips scroll via overflow-x:auto on .filter-chips).
13. Toggle-only popovers (no click-outside/Esc) — consistency with existing ConfigPanel; wholesale change = follow-up ticket (CLAUDE.md "change a pattern wholesale").

## Open threads / risks for review stage

- Empty-set-while-first-resolving means a vault opened with ONLY persisted content terms briefly shows the empty-state message until the search resolves. Deemed acceptable; if reviewer objects, alternative = keep unfiltered until first resolve (everything-then-narrow flash). Either is one-line.
- `filterVaultTree` root always survives even with 0 children (AC8) — TreemapViz handles zero leaves via new `.viz-empty-msg`; check d3 hierarchy on childless root doesn't throw (leaves() returns [root] when root has no children — implementer must gate empty-state on `filter active && leaves with no data.path`… actually simpler: root with `children: []` → hierarchy leaves = [root] which has no `size` → sum 0. Implementer should verify rendering path; flagged mentally, not in public plan. If problematic: guard `treeRoot.children?.length === 0` → skip layout, render message.)
- Chips overflow: `.filter-chips { overflow-x:auto }` inside 42px header — scrollbar may look chunky; `scrollbar-width: thin` or hidden scrollbar could be needed.
- `HeatmapOptions` keeps its own "Timestamp field" RadioGroup (config panel unchanged) — field now editable from TWO places; both write `config.field` through same updateConfig → consistent by construction.
- Segments-from-hierarchy: `d.ancestors().reverse().slice(1).map(a => a.data.name)` — verify against the FILTERED/pruned copy: names are preserved by both prune and filter (spread copies), so trail names resolve against canonical data. Filtered tree ⊆ canonical, always resolvable.
- data-refresh + folderSegments derived trail returns null if folder vanished → fallback to root, breadcrumb derived from trail (=[]) so back button disappears while stale segments linger harmlessly in state. Decided NOT to auto-clear segments (avoid setState-in-render); mention if reviewer asks.

## Follow-up tickets promised (Phase 6)

(a) exclusion terms; (b) content-match perf (mtime-keyed cache / chunked reads); (c) popover click-outside/Esc wholesale; (d) React test harness evaluation.

## Where things are

- Plan: .ai_out/heatmap-filter-ui/heatmap-filter-ui/DETAILED_PLANNING__PUBLIC.md
- Inputs: EXPLORATION_PUBLIC.md, CLARIFICATION__PUBLIC.md (same dir)
- Design memory used: ${MY_DEEP_MEM}/my-frontend-design.md (chips: no color-alone; empty states; accessibility labels; spacing scale)
