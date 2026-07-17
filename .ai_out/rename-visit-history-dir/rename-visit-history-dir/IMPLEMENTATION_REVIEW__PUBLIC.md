# IMPLEMENTATION REVIEW — rename `.visit_history` → `__visit_history`

Reviewed: commits c6b06fe..464ab60 (`git diff fbc561c..HEAD`), branch `rename-visit-history-dir`.

## Verdict: **READY**

No blocking issues. All binding CLARIFICATION decisions are correctly implemented and
verified against the actual code (not just the implementer's report). One behavioral
side-effect needs human awareness/sign-off (question below) — it is inherent to the
accepted "make the dir sync" decision, not an implementation defect.

## Actual verification results (run by reviewer)

| Check | Result |
|---|---|
| `vitest run` (= npm test) | **36 files, 315 tests — ALL PASS**, exit 0 (matches claim: +10 new over 305 baseline) |
| `eslint .` (= npm run lint) | **0 errors**, 2 pre-existing warnings (`main.ts:97,101` obsidianmd/prefer-active-doc) |
| `tsc -noEmit -skipLibCheck` + `esbuild production` (= npm run build) | **PASS**, exit 0; no build artifacts committed |

Note: bare `npm`/`node` are broken in this review environment (shell-profile lazy-nvm
shim prints `nvm.sh NOT found` and exits 1); all commands were run via explicit binary
paths (`./node_modules/.bin/...`, `/usr/local/bin/node`). Environment issue, not repo —
worth a follow-up ticket for the agent environment.

## Requirements verification (read from the diff)

- **`VhUserPaths.TOP_DIR = '__visit_history'`** with the required forum-issue URL in a WHY
  comment at the constant (`src/core/service/visitHistoryService/user/VhUserPaths.ts:20-24`). Confirmed single source of truth — all active paths derive from it.
- **Migration** (`src/core/service/migration/VhTopDirRenameMigrationService.ts`): legacy absent → no-op;
  both exist → SKIP, never merge/delete, `console.error` + user-facing notice via injected
  `UserNotifier` interface (DIP, Obsidian-agnostic); else whole-subtree rename. Cleanup TODO
  2026-October. Matches CLARIFICATION exactly. `HiddenFileUtilDefault.rename` throws loudly on
  existing destination; `ensureParentFolders` is a correct no-op for the top-level target.
- **onload ordering** (`src/main.ts:23-47`): rename migration FIRST (own try/catch,
  never blocks load) → user-name resolution → `VhUserScopeMigrationService` → PluginFactory.
  Matches the binding mobile-adoption ordering decision.
- **Tracking exclusion** (`src/core/util/vault/IsTrackedProvider.ts:37-40`): new DRY private
  helper `isVisitHistoryPath` covers BOTH `__visit_history` (new) and legacy `_visit_history`,
  used by BOTH `isTrackedFile` and `isTrackedView`. (`'__visit_history'.startsWith('_visit_history')`
  is false, so both prefixes are genuinely required — and both are present.) Well-documented WHY.
- **Tests cover the decision matrix**: 8 new migration cases (clean move + content intact, no
  leftover, absent no-op, already-migrated no-op, no notice on clean move, both-exist untouched,
  notifier invoked, console.error) + `__visit_history` README-exclusion cases for both
  IsTrackedProvider methods. **No behavior-capturing tests removed** (the two deleted `it(` lines
  are title renames; assertions kept). No anchor points touched.
- **No stale `.visit_history` literals** in production code — remaining occurrences are
  intentional (migration source constant, legacy-data references in comments/README/docs).
- **README writer + docs**: generated README tree/bullets updated incl. WHY-not-dot-hidden;
  AGENTS.md (CLAUDE.md symlink confirmed), README.md, docs/architecture.md,
  docs/visit-history-format.md all accurate; "invisible to Vault API" invariant correctly
  reworded to IsTrackedProvider enforcement.

## Findings

| # | Severity | Location | Issue | Suggested direction |
|---|---|---|---|---|
| 1 | SHOULD-FIX (awareness) | `UserNameProvider.ts` mobile adoption (behavioral side-effect, no code change in that file needed) | Because `__visit_history/user/<name>` now SYNCS, mobile single-dir adoption can adopt a name that arrived via sync. Personal vault: desirable (fresh phone joins your desktop identity instead of minting `mobile-user-XXXX`). SHARED vault where only person A has history: person B's fresh phone would adopt A's name → histories mix, contradicting the "never mix" doc invariant. Pre-rename this was impossible (dir never synced). | Human sign-off (see question below); if accepted, add one doc sentence to the user-scoping bullet noting adoption may join a synced identity. |
| 2 | NIT | `IsTrackedProvider.ts:39` | Bare `startsWith` prefix also excludes siblings (`__visit_history_notes/x.md`, a root note `__visit_history.md`). Pre-existing semantics inherited from the `_visit_history` check; implementer flagged it transparently. | Optional boundary-aware check: `p === dir \|\| p.startsWith(dir + '/')` inside the new helper. |
| 3 | NIT | `VaultTreemapView.tsx:72` | `vault.on('create')` now fires for new `.vh_v3`/README files (dir is Vault-API visible) → debounced no-op treemap refresh (files excluded from the tree anyway). Harmless churn, rare events (`modify` is not registered). | None needed; note for the future. |
| 4 | NIT | `main.ts:27-34` + `UserNameProvider` | Compound edge: if the rename migration THROWS unexpectedly on a mobile device holding legacy data with no cached user name, a bogus `mobile-user-XXXX` is minted permanently (first-resolution-wins). Rare (old-plugin mobile devices already have cached names); same risk shape pre-existed with the user-scope migration. | Accept; not worth complexity. |

## #QUESTION_FOR_HUMAN

- Finding 1: Confirm it is acceptable (and arguably desirable for personal vaults) that a
  fresh mobile device may now ADOPT a user name that arrived via Obsidian Sync
  (`__visit_history/user/<name>` dirs sync now). In a multi-person vault where exactly ONE
  person has history, a different person's fresh phone would join that identity. If accepted,
  a one-line doc note in the user-scoping section is suggested.

## CLAUDE.md conformance

Strict TS clean (tsc passes, no new `as` casts), DIP respected (UserNotifier interface
injected), SRP (new focused one-purpose migration service mirroring the existing one),
DRY (single TOP_DIR source of truth; exclusion helper extracted), comments WHY-focused,
only `console.error`, GIVEN/WHEN/THEN one-assert tests, docs succinct and accurate.
No over-engineering; the duplicated early `UserNotifierDefault` in main.ts is trivial and
justified (avoids reordering factory wiring for a temporary migration).

## Findings count

BLOCKING: 0 · SHOULD-FIX: 1 (human-awareness question) · NIT: 3
