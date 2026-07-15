# PARETO_COMPLEXITY_ANALYSIS — Heatmap Filter UI

> Role: PARETO_COMPLEXITY_ANALYSIS (final phase). Basis: diff `1d1d3c6..HEAD`
> (branch `heatmap-filter-ui`), CLARIFICATION / DETAILED_PLANNING /
> IMPLEMENTATION / REVIEW / ITERATION public docs, spot-reads of the heaviest
> files (`App.tsx`, `filterVaultTree.ts`, `ContentTermMatcher.ts`,
> `FilterTermOps.ts`, `FilterPopover.tsx`).

## Pareto Assessment: **PROCEED** — Verdict: **JUSTIFIED**

**Value Delivered:** Include-only path/content filtering of the heatmap
(persisted, drill-down-safe), header reworked from info-heavy to action-first
(info/field/filter/config popovers), plus a genuine nav-correctness fix.

**Complexity Cost:** +1337 / −120 lines, but composition: ~470 lines are tests
(AC1–AC19, repo policy), ~213 CSS (reuses existing recipes), ~590 across 8 new
files each ≤ 90 lines of logic. No new dependency, no new pattern the codebase
didn't already have (interface+Default, `*Ops` static class, pure tree
transform, open-class popover).

**Ratio:** **High.** Each requirement maps to a small, testable unit; the plan
explicitly rejected the two heavy alternatives (content index on VaultNode;
host-side filtering) and deferred all speculative work to tickets.

## Per-hotspot judgments

### 1. Path-segment nav refactor (`App.tsx` folderSegments) — **JUSTIFIED**
Looks like scope creep; is not. With filtering, the old `navStack: VaultNode[]`
(nodes from a pruned COPY) becomes a hard bug: drill in with a filter on →
removing the term can never restore files. Any fix must re-resolve nav against
canonical `data`; storing path segments and deriving `trail`/`currentRoot` per
render IS the minimal such fix (~40 lines, reuses existing tested
`findFolderTrail`). Also fixed the latent stale-subtree-after-refresh bug for
free. No materially simpler alternative existed.

### 2. ContentTermMatcher seam — **JUSTIFIED**
59 lines including docs; interface + `Default` in one file (exact `FileOpener`
precedent), injected as an App prop. Required by the hard constraint that
`view/` stays Obsidian-agnostic while content lives behind the Vault API. The
async surface is confined to ONE `useEffect` with a cancel flag —
no request-counter machinery, no debounce (discrete user actions ARE the
debounce), no cache/index in v1 (correct Pareto call; ticketed). The rejected
alternative C (content index at tree-build time) would have been the
over-engineered path — avoided.

### 3. FilterTermOps + FILTER_TERM_KEY_SEP — **JUSTIFIED, with one micro-nit**
The class itself (45 lines, 3 static methods, mirrors `BoundedValueOps`) is
the right call: it made the trim/dedupe rule exist ONCE (review finding 2)
across UI adds and the data.json sanitizer.
**Micro-nit (over-engineered corner):** the reserved NUL separator + ban-in-add
+ 2 tests exist only so the effect-dep key can be `split()` back losslessly.
Using `JSON.stringify(contentTerms)` as the memo key and recomputing the term
array inside the effect would have eliminated the entire reserved-character
invariant (~15 lines + a cross-file contract). Cost is trivial and it is
correct as written — **not worth reworking**, just noting the simpler shape
for future maintainers.

### 4. Popover set (FilterPopover / FieldPopover / InfoPopover / FilterGroup) — **JUSTIFIED (no framework built)**
This is emphatically NOT a popover framework: 27–61 lines each, one shared CSS
recipe (`.hdr-pop`, copied from the existing config panel), one
`openPanel: HeaderPanel | null` state giving structural mutual exclusion,
CSS-only anchoring (no refs/measurement JS), click-outside/Esc deliberately
deferred wholesale (ticketed). This is the 20%-effort version of the UI.
FieldPopover/InfoPopover reuse `RadioGroup`/`Legend`/`FIELD_OPTIONS` as-is —
real DRY, not abstraction for its own sake.

### 5. filterVaultTree (pure tree filter) — **JUSTIFIED**
69 lines mirroring `pruneArchiveFolders`; identity fast-path preserves the
layout memo. The one subtle bit — `undefined` (content filtering inactive) vs
EMPTY set (terms exist, nothing matched/pending) — carries REAL semantics the
feature needs, is documented at the type, and is pinned by tests (AC12).
Essential complexity, not incidental.

### 6. Under-engineering check — **none found that matters**
- v1 content search re-reads all tracked files per term change (via
  `cachedRead`): accepted, ticketed, correct — building an mtime-keyed index
  now would be premature.
- Unbounded `Promise.all` fan-out over vault files: same ticket; fine for v1.
- No React harness → popover behavior is manual-verify: honest, ticketed,
  consistent with the repo-wide stance; all decision logic was pushed into
  tested viewModel code, which is the right mitigation.

## Follow-up ticket ROI triage

| Ticket | ROI call |
|---|---|
| `heatmap-popover-dismissal.md` (click-outside/Esc) | **Highest ROI next step** — small wholesale change, daily-felt UX. Do first. |
| `heatmap-content-match-performance.md` | Keep parked; implement ONLY on a real large-vault complaint. Do not build preemptively. |
| `heatmap-filter-exclusion-terms.md` | Keep parked; demand-driven. |
| `react-component-test-harness.md` | Lowest ROI at current codebase size; keep parked, revisit if view logic grows. Do NOT drop — it documents the accepted gap. |

Nothing to drop; nothing new to ticket.

## Bottom line

The team repeatedly chose the simple branch at every fork (CSS over JS
anchoring, no index, no debounce machinery, no negation syntax, no framework)
and spent complexity only where correctness demanded it (nav refactor,
undefined-vs-empty semantics, latest-wins cancellation). **JUSTIFIED — merge
as-is; no simplification pass warranted.**
