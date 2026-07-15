# IMPLEMENTATION_REVIEWER — private memory (heatmap-filter-ui)

## State: review COMPLETE — verdict APPROVED, written to IMPLEMENTATION_REVIEW__PUBLIC.md

## Environment gotchas (rehydration shortcuts)
- Shell shadows node/npm — use `/usr/local/bin/npm`. Every Bash call spews ~30 lines of env-setup noise; ignore it.
- `sanity_check.sh` does NOT exist in this repo.
- Redirect gates to `.tmp/` (rev_test.log / rev_lint.log / rev_build.log — already there).
- Diff dump: `.tmp/rev_diff.txt` (2103 lines, `git diff 1d1d3c6..91edde3 -- src/ styles.css CLAUDE.md docs/`).
  NOTE: CLAUDE.md is a SYMLINK → AGENTS.md; diff AGENTS.md separately to see doc changes.

## Verified numbers (independent)
- Branch: 333/333 tests, 39 files; lint 0 errors + 2 PRE-EXISTING warnings (main.ts prefer-active-doc); build clean.
- Master comparison: ran master in a scratchpad worktree (symlinked node_modules) → **298 tests / 35 files**. So branch = +35/+4, zero removals (also grep: 0 removed `it(` lines, 0 deleted files, no `ap.*` anchors removed).
- The "336/336" figure in old master commit message 4e103a7 is WRONG (empirically 298) — don't chase it again.
- merge-base HEAD master = c337cee (master tip) — branch fully contains master.

## Key verifications done (don't redo)
- `findFolderTrail` (src/viewModel/folderTrail.ts): trail EXCLUDES vault root → `trail.map(n=>n.name)` round-trips folderSegments correctly; matches only nodes with `children` (folders). Empty path → guarded by `folderSegments.length > 0`.
- `d.ancestors().reverse().slice(1)` — hierarchy root = rendered root (`currentRoot ?? data`), so segments are root-relative; append in App unifies root/drilled. Correct.
- Obsidian-agnostic grep: only VaultTreemapView.tsx (view/) + pre-existing FileOpener.ts / buildVaultTree.ts (viewModel/) import obsidian; ContentTermMatcher.ts has NO obsidian import (TFile via inference); its test uses type-only import.
- TreemapViz stats: `onStatsChange({files: leaves.length, ...})` at TreemapViz.tsx:176-181 — leaves are post-filter → filtered stats requirement MET.
- Childless-root leaves() guard: legit d3 behavior (leaves() of childless root = [root]); guard also fixes empty-vault stats counting root as a file.
- Content effect (App.tsx): deps [contentTermsKey, data, contentTermMatcher]; cancelled flag; `prev ?? new Set()`; NUL-joined key. All per plan incl. PLAN_REVIEWER data-dep fix.
- Sanitizer + FilterTermOps + filterVaultTree + ContentTermMatcher tests: spot-checked against AC1–AC19 — all present, assertions real (reference-equality no-ops, structuredClone purity).

## Findings issued (all MINOR, none blocking)
1. FilterPopover Enter lacks `isComposing` guard (IME partial-term commit) — FilterPopover.tsx onKeyDown.
2. DRY: trim+ci-dedupe rule duplicated between FilterTermOps.add and sanitizeFilterTerms (cross-referenced in comments; suggest sanitizer folds FilterTermOps.add).
3. NUL-invariant comment in App.tsx not enforced at data.json boundary (sanitizer doesn't strip control chars → hand-edited NUL term splits into 2 OR'd terms; benign).
4. Field-selector button has aria-expanded but no `.active` class while its popover is open (icon buttons do).
- Accepted note: content-only persisted terms → brief empty-state flash at mount (plan-review MINOR #3, accepted).

## Deviations: all 3 assessed SOUND (resolved-trail rebase = safer superset; leaves() guard = required; FilterTermOps = plan §5 implied, mirrors BoundedValueOps).

## If iteration ever happens, re-check
- That finding fixes don't touch behavior tests; re-run master-comparison only if test count DROPS below 333.
