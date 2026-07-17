# IMPLEMENTATION ITERATION — review feedback applied

Branch: `rename-visit-history-dir`. Applies accepted findings from
`IMPLEMENTATION_REVIEW__PUBLIC.md`.

## Applied

### Finding #2 (NIT) — boundary-aware tracking exclusion
- `src/core/util/vault/IsTrackedProvider.ts`: `isVisitHistoryPath` no longer uses a
  bare `startsWith(prefix)`. New private `isUnderDir(path, dir)` helper:
  excluded iff `path === dir || path.startsWith(dir + '/')`, applied to BOTH
  `__visit_history` and legacy `_visit_history`. Sibling paths like
  `__visit_history_notes/note.md` are now tracked.
- Tests (failing-test-first verified: 4 failed pre-fix, pass post-fix) in
  `IsTrackedProvider.test.ts`, existing GIVEN/WHEN/THEN one-assert style:
  - `isTrackedFile`: sibling `__visit_history_notes/note.md` tracked; sibling
    legacy `_visit_history_notes/note.md` tracked.
  - `isTrackedView`: same two sibling cases tracked.
  - Existing `__visit_history/user/x/v3/README...` and legacy `_visit_history/...`
    NOT-tracked cases retained and still pass.

### Finding #1 (SHOULD-FIX, human-approved doc note)
- `AGENTS.md` "User scoping" bullet (CLAUDE.md is a symlink — AGENTS.md edited only):
  added one sentence — because `__visit_history/` now syncs, a fresh mobile device's
  single-existing-user adoption may join an identity that arrived via Obsidian Sync
  (accepted; a user-name confirmation modal is planned to supersede silent adoption).
- `docs/architecture.md` checked: contains NO user-scoping/mobile-adoption wording,
  so per scope ("nowhere else") it was not touched. (`docs/visit-history-format.md`
  has similar wording but was explicitly out of scope.)

## Rejected / deferred (per review verdict)

- Finding #3 (NIT, vault `create` event churn on `.vh_v3` files): ACCEPTED-AS-IS, no change.
- Finding #4 (NIT, compound migration-throw + mobile name-mint edge): ACCEPTED-AS-IS, no change.

## Verification (actual numbers)

| Check | Result |
|---|---|
| `vitest run` | 36 files, **319 tests — ALL PASS** (315 + 4 new), exit 0 |
| `eslint .` | **0 errors**, 2 pre-existing warnings (`main.ts:97,101` prefer-active-doc) |
| `tsc -noEmit -skipLibCheck` | exit 0 |
| `node esbuild.config.mjs production` | exit 0, no artifacts committed |

Commit: see `git log` on `rename-visit-history-dir` (iteration commit
"iterate: boundary-aware __visit_history exclusion + sync-adoption doc note").

## Readiness

**READY** — all accepted review feedback applied; suite green; no open questions.
