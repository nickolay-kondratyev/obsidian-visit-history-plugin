# PLAN_REVIEWER private memory — heatmap-filter-ui (DETAILED_PLAN_REVIEW)

## Status
Review COMPLETE. Verdict: APPROVED-with-inline-adjustments. PLAN_ITERATION skippable.
Outputs written: DETAILED_PLAN_REVIEW__PUBLIC.md (this dir). 3 inline edits made to DETAILED_PLANNING__PUBLIC.md, all marked `[PLAN_REVIEWER]`.

## What I verified against source (all held up unless noted)
- `src/view/components/App.tsx`: navStack/currentRoot are VaultNode STATE (node objects), seeded from `findFolderTrail`; `configOpen` bool; `updateConfig` plain fn; stats via `onStatsChange`. Plan's claim that navStack holds nodes from a pruned COPY is TRUE: `FolderNode.onClick` passes `d.data` where `d` comes from hierarchy over `treeRoot = showArchived ? root : pruneArchiveFolders(root)` (TreemapViz.tsx:132-135, 261). So the "remove filter while drilled → files never restored" bug is real; Phase 3 is a justified prerequisite, NOT scope creep.
- `src/viewModel/folderTrail.ts`: findFolderTrail exists, tested; `findFolderTrail(data,'')` → null (splits '' to ['']) → `?? []` fallback works; no special-casing needed.
- `src/viewModel/pruneArchiveFolders.ts`: pattern matches plan §2.2; `isWithinArchive(trail: VaultNode[])` — works with derived trail.
- `src/viewModel/heatmapConfig.ts`: sanitizer per-field style matches plan's `sanitizeFilterTerms` sketch.
- `src/view/components/Header.tsx`: current children match exploration; `⚙ config` text button; breadcrumb group precedent.
- `src/view/components/ConfigPanel/HeatmapOptions.tsx:13-17`: FIELD_OPTIONS built inline — extraction to view/constants.ts is a real DRY move; RadioGroup reuse valid.
- `src/core/util/vault/VaultUtil.ts`: only getName + getTrackedFiles (which does per-file lastVisit reads — plan's WHY-NOT for reuse is correct). No VaultUtil.test.ts exists yet (AC19 = new coverage).
- `NoteFileUtil.cachedRead(file: TFile)` exists (line 17).
- `PluginFactory`: readonly-field exposure style; has vaultUtil; noteFileUtil is a local const (line 51) — plan acknowledges.
- `src/testSupport/fakes.ts` has FakeVaultUtil; FakeNoteFileUtil is a SEPARATE file `src/testSupport/FakeNoteFileUtil.ts` (plan says "FakeNoteFileUtil" generically — fine).
- `src/viewModel/FileOpener.ts` imports `obsidian` directly → viewModel-hosts-obsidian-impl precedent confirmed; ContentTermMatcher placement OK. App already type-imports IFileOpener — same pattern.
- `VaultTreemapView.tsx`: refresh on vault create/delete/rename ONLY (lines 72-74), debounced; key stable on plain refresh (App NOT remounted → data prop changes in place) — supports both the latent stale-nav bug claim and my effect-deps fix.

## The two real findings (fixed inline)
1. **Drilled-in segment mapping bug**: hierarchy root is `currentRoot ?? data`, so `d.ancestors().reverse().slice(1)` is RELATIVE to rendered root. Plan said handleFolderClick "just sets state" → replace semantics would break drill-beyond-first-level whenever drilled. Fix: APPEND `[...prev, ...relativeSegments]`. Edited §2.3 bullet + Phase 3 step 2.
2. **Effect deps**: plan text said matching "re-runs on vault-refresh re-render" — effects don't re-run on re-render. Without `data` dep, RENAME leaves stale old path in contentMatchedPaths → matched file vanishes until next term change. Fix: deps = terms AND data. Edited §2.1 staleness note.

## Borderline calls / rationale
- Both fixes are severity-MAJOR findings but adjustment-MINOR (one-line, non-contentious, no direction change) → inline edit under empowerment; called out prominently. If anyone disputes, the alternative is one PLAN_ITERATION round re-stating the same fix.
- Mount flash of empty-state with persisted content terms (empty-set-until-resolved): accepted; alternatives (unfiltered-first = flash-then-vanish; "searching…" state = gold-plating). MINOR note only.
- Nav derivation in App.tsx untestable (no React harness): acceptable, reuses tested findFolderTrail; suggested optional `deriveNavState` extraction if it grows. Did NOT require it (KISS).
- Whole-vault content scan while drilled: fine (PARETO; matcher stays nav-agnostic).
- Behavior changes from nav fix (back walks one level; full breadcrumb) are HUMAN-visible → surfaced as non-blocking #QUESTION_FOR_HUMAN (recommendation yes) alongside the plan's own cost-model question.
- Did NOT read ${MY_DEEP_MEM}/my-frontend-design.md (not needed to validate; chip spec cites "never color alone" which plan honors via glyph+tint+title).

## Requirements matrix
All 7 CLARIFICATION decisions covered (table in public review). ACs 1-19 all pure-unit, vitest-realistic. Scope exclusions match approved include-only OR semantics.

## If rehydrated for a re-review after PLAN_ITERATION or IMPLEMENTATION questions
- Watch that implementation actually uses append semantics + data-dep; watch `folderSegments` vs trail fallback when a segment no longer resolves (must fall back to vault root, no ghost breadcrumb — plan §2.3 derives breadcrumb from TRAIL, correct).
- AC12's "EMPTY set + no path terms → all leaves removed" is intentional (content filter active, zero matches).
- Dedupe is per (kind, lowercased text); AC5 guards cross-kind survival.
