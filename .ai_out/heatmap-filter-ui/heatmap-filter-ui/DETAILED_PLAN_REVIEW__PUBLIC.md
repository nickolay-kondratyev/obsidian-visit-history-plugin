# Plan Review — Heatmap Filter UI (DETAILED_PLAN_REVIEW)

> Role: PLAN_REVIEWER. Input: `DETAILED_PLANNING__PUBLIC.md` vs `CLARIFICATION__PUBLIC.md` (7 HUMAN-approved decisions) + `EXPLORATION_PUBLIC.md`, verified against source.

## Executive Summary

The plan is well-grounded: every non-trivial claim I checked against the code holds (App nav state, TreemapViz `treeRoot` memo, `pruneArchiveFolders` pattern, `findFolderTrail`, `NoteFileUtil.cachedRead`, `PluginFactory` exposure style, `FileOpener.ts` viewModel precedent, `FakeVaultUtil`/`FakeNoteFileUtil`, refresh events = create/delete/rename only). All 7 approved decisions are covered, the content-search seam is designed at the right boundary, and the testing strategy is realistic for vitest (all logic in pure viewModel units; React shells manual). I found one real correctness bug in the plan's drill-down mechanics and one under-specified effect dependency — both had non-contentious one-line fixes that do not change the approach, so I applied them inline.

## Verdict

- [x] **APPROVED-with-inline-adjustments**

**PLAN_ITERATION: CAN BE SKIPPED.** No feedback point requires re-planning; the two correctness items are fixed inline in the plan itself.

## Feedback points

1. **[MAJOR — FIXED INLINE] Drill-down segment mapping was wrong when already drilled in (§2.3, Phase 3).**
   The d3 hierarchy in `TreemapViz` is built over `treeRoot = currentRoot ?? data` (`src/view/components/TreemapViz.tsx:132-135`). When drilled in, `d.ancestors()` stops at the CURRENT root, so `d.ancestors().reverse().slice(1)` yields segments **relative to the rendered root**, not vault-relative. The plan's "`App.handleFolderClick(segments)` just sets state" would REPLACE `folderSegments` with the relative path — every drill past the first level would resolve to a wrong/absent trail and snap the view back to vault root. Fix (applied inline, marked `[PLAN_REVIEWER]`): App APPENDS — `setFolderSegments(prev => [...prev, ...relativeSegments])`; the vault-root case unifies (`prev === []`). Rationale for inline: single-line semantics fix, no direction change; leaving it would ship a broken Phase 3.

2. **[MAJOR — FIXED INLINE] Content-match effect deps under-specified; rename could permanently hide a matched file (§2.1).**
   The plan's staleness note claimed matching "re-runs on vault-refresh re-render" — but a re-render alone re-runs no effect; deps as described were only the term set. Without `data` in the deps, a RENAME of a content-matched file leaves its stale OLD path in `contentMatchedPaths`, silently dropping the file from the filtered view until the next term change. Fix (applied inline): effect deps = content terms AND `data` (vault refresh rebuilds `data` on create/delete/rename — matching re-runs then; edits remain accepted-stale, consistent with the plan's own scope exclusion). `cachedRead` keeps the re-run cheap.

3. **[MINOR — no change required] Mount flash of the empty-state with persisted content terms.**
   On mount with persisted content-only terms, the plan's "empty set until first resolution" shows "No files match the current filters" for the scan duration (possibly ~1 s on large vaults) before filling in. The alternative (unfiltered-then-narrow) was rightly rejected (flash-then-vanish). Acceptable v1 trade-off; implementers may optionally word the empty-state to be honest under both causes, but a dedicated "searching…" state would be gold-plating.

4. **[MINOR — suggestion only] Phase 3 nav derivation is manual-verify only.**
   The segments→trail→(currentRoot, breadcrumb, showArchived) derivation lives in `App.tsx` (untestable — no React harness). It mostly reuses the already-tested `findFolderTrail`, so this is acceptable under KISS; if the derivation grows beyond the ~4 lines sketched, extract a pure `deriveNavState(data, segments)` into `src/viewModel/` for unit tests. Not required now.

5. **[MINOR — noted, fine as-is] Content matcher scans the whole vault even when drilled into a folder.**
   Decision 7 scopes *filtering* to the viewed root, which the pure tree filter honors; the matcher still reads all tracked files. Restricting reads to the subtree would complicate the seam (matcher would need nav state) for a rare win — correct PARETO call, and the result set stays valid across navigation. No change.

## Requirements coverage (CLARIFICATION decisions 1–7)

| # | Decision | Covered |
|---|----------|---------|
| 1 | INFO icon collapses title+stats+legend | Yes — §2.4/Phase 4 (`InfoPopover`, title removed, `Legend` reused as-is) |
| 2 | Field indicator actionable, reuse config-panel component | Yes — `.ts-indicator` → button + popover with the SAME `RadioGroup`; `FIELD_OPTIONS` extracted to `view/constants.ts` (verified it currently lives inline in `HeatmapOptions.tsx:13-17` — real DRY win) |
| 3 | Two term kinds, visually distinguishable | Yes — glyph prefix + distinct tint + `title` (not color alone, per design memory) |
| 4 | OR, include-only | Yes — §2.2 predicate; exclusions ticketed |
| 5 | Persist in HeatmapConfig, survive restarts + drill-down | Yes — §2.5; nav-independent by construction |
| 6 | Header layout, filter icon left-most, popover pattern, no `setIcon` | Yes — §2.4 matches approved sketch; Unicode glyphs match existing `⚙`/`←` precedent |
| 7 | Filter applies to viewed root; stats/legend reflect filtered view | Yes — filter composed into `treeRoot` memo; stats bubble from rendered layout (verified `onStatsChange` derives from laid-out leaves/folders) |

## Architecture / principles check

- **Obsidian-agnostic view preserved**: `ContentTermMatcher` interface is obsidian-type-free; impl-in-same-file matches the `FileOpener.ts` precedent (which itself imports `obsidian` in viewModel — established pattern). `App` takes the interface as a prop, exactly like `fileOpener`/`configStore`.
- **DI**: `PluginFactory` exposure matches its existing `readonly` field style; it already holds `vaultUtil` + local `noteFileUtil`.
- **DRY/SRP**: `filterVaultTree` mirrors `pruneArchiveFolders` (pure, copy, prune-empties); `getTrackedTFiles` refactor removes wasted last-visit reads instead of duplicating file enumeration; `FIELD_OPTIONS`/`RadioGroup`/`SegmentedToggle`/`Legend` reuse is genuine.
- **Phase 3 is justified scope, not creep**: verified `navStack` stores nodes of the pruned COPY (FolderNode passes `d.data` from the hierarchy over `treeRoot`), so "remove term while drilled → files can never come back" is a real bug the filter feature would introduce; the path-based fix is the minimal correct remedy and also fixes the latent stale-subtree-after-refresh bug.
- **KISS/PARETO**: no index/cache, no per-keystroke filtering, no negation, no click-outside (consistency with existing panel) — all deliberately excluded with follow-up tickets. Good restraint.
- **Testability**: AC1–AC19 all target pure units (sanitizer, tree filter, matcher, VaultUtil) — realistic under vitest with existing fakes; React-only behavior explicitly listed as manual.

## Inline edits made (all marked `[PLAN_REVIEWER]` in the plan)

1. §2.3 drill-down bullet — relative-segments + APPEND semantics (feedback #1).
2. Phase 3 step 2 — `handleFolderClick` appends, not replaces (feedback #1).
3. §2.1 staleness note — effect deps made explicit (content terms AND `data`), with rename rationale (feedback #2).

## #QUESTION_FOR_HUMAN:

1. **(Non-blocking — plan already calls it out transparently, §2.3)** The nav-correctness fix changes two visible behaviors: (a) after clicking a folder 2+ levels deep, "back" now walks up ONE level at a time (today it jumps straight back), and the breadcrumb shows the true full path; (b) vault refresh no longer shows a stale subtree while drilled in. Both align with the already-approved seeded-trail behavior. Confirm acceptable (recommendation: yes).
2. **(Carried from the plan, §8 — non-blocking)** v1 content search re-reads every tracked file via Obsidian's `cachedRead` on each content-term change (no persistent index); follow-up ticket covers mtime-keyed caching if large vaults hurt. Confirm acceptable (recommendation: yes).
