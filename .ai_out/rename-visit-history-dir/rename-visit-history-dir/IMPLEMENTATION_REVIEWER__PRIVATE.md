# IMPLEMENTATION_REVIEWER — PRIVATE memory (rename-visit-history-dir)

Reviewed commits c6b06fe..464ab60 (`git diff fbc561c..HEAD`), branch `rename-visit-history-dir`.

## Environment gotcha (IMPORTANT for future clones)
Bare `npm` / `node` commands FAIL in this review env with
`[/home/node/.nvm/nvm.sh] NOT found not sourcing NVM_SH` + exit 1 — the shell
profile defines lazy-nvm shim functions shadowing `node`/`npm`. Workaround:
use explicit paths — `/usr/local/bin/node`, `./node_modules/.bin/vitest run`,
`./node_modules/.bin/eslint .`, `./node_modules/.bin/tsc -noEmit -skipLibCheck`,
`/usr/local/bin/node esbuild.config.mjs production`. This is an ENV issue, not repo.
No `sanity_check.sh` in repo.

## Actual verification results (2026-07-16)
- `vitest run`: 36 files, 315 tests, ALL PASS (exit 0) — matches implementer's claim (+10 over 305 baseline).
- `eslint .`: 0 errors, 2 pre-existing warnings (main.ts:97,101 obsidianmd/prefer-active-doc) — matches claim.
- `tsc -noEmit -skipLibCheck`: exit 0. `esbuild production`: exit 0. main.js untracked (clean git status).

## What I verified by reading code (not just PUBLIC.md)
- `VhUserPaths.TOP_DIR = '__visit_history'` with WHY comment + forum URL at the constant (VhUserPaths.ts:20-24). Single source of truth confirmed; everything derives from it.
- `VhTopDirRenameMigrationService` (56 lines): exists(legacy)→no-op; exists(dest)→console.error + userNotifier.showError + return (never merge/delete); else rename. Matches CLARIFICATION exactly. UserNotifier injected as interface (DIP); service Obsidian-agnostic.
- main.ts onload ordering CORRECT: loadSettings → hiddenFileUtil → rename migration (own try/catch, never blocks load) → getUserName → VhUserScopeMigrationService → PluginFactory. Matches the binding "rename FIRST" decision.
- `IsTrackedProviderDefault.isVisitHistoryPath` (new private static helper, DRY): `startsWith(VhUserPaths.TOP_DIR) || startsWith(VISIT_HISTORY_TOP_DIR)`; used by BOTH isTrackedFile and isTrackedView. `'__visit_history'.startsWith('_visit_history')` is false (index 1 `_` vs `v`) so both prefixes needed and present. Import VhUserPaths→no deps, no cycle.
- New migration tests: 8 cases covering full decision matrix (clean move + content intact, no leftover, absent no-op, already-migrated no-op, no notice on clean move, both-exist keeps both untouched, notifier invoked, console.error). RecordingUserNotifier fake. Good.
- IsTrackedProvider tests: added `__visit_history` README `.md` exclusion for both methods; legacy `_visit_history` tests KEPT (only titles renamed — verified via `git diff | grep '^-.*it('`).
- No stale `.visit_history` literals in production code except intentional legacy references (LEGACY_TOP_DIR constant, migration comments, ReadmeWriter legacy bullet, VhUserPaths WHY comment).
- `HiddenFileUtilDefault.rename`: exists(dest) throws loudly; `ensureParentFolders('__visit_history')` → segments=[] → no-op for top-level. FakeHiddenFileUtil mirrors (subtree move, throws on existing dest).
- VhV3ReadmeWriter: ASCII tree updated, legacy bullet now lists `.visit_history` too, new WHY-not-dot-hidden bullet.
- Docs (AGENTS.md=CLAUDE.md symlink confirmed, README.md, docs/*) accurate; remaining `.visit_history` mentions in docs are intentional (migration/legacy descriptions).
- No anchor points removed (grep `ap_` on diff: nothing). No behavior-capturing tests removed.
- VaultTreemapView registers vault create/delete/rename → scheduleRefresh (debounced). Only other getFiles() caller is VaultUtil.getTrackedTFiles (gated by IsTrackedProvider).

## Findings (final)
- BLOCKING: none.
- SHOULD-FIX (awareness / #QUESTION_FOR_HUMAN): mobile single-dir user ADOPTION semantics silently change. Pre-rename, `.visit_history` never synced, so mobile adoption only ever saw locally-created user dirs. Post-rename, `__visit_history/user/<desktop-user>` SYNCS to mobile → a fresh mobile device (no cached name) in a vault with exactly one synced user dir ADOPTS that name. Personal vault: desirable (phone joins desktop identity). SHARED vault where only person A has history: person B's fresh phone adopts A's name → histories MIX (violates "never mix" doc invariant). Inherent to the accepted sync decision; needs human sign-off + possibly a doc note.
- NIT: `isVisitHistoryPath` bare `startsWith` also excludes siblings like `__visit_history_notes/` or a root note `__visit_history.md` (pre-existing pattern for `_visit_history`, implementer flagged it). Boundary-aware check (`p === d || p.startsWith(d + '/')`) would fix.
- NIT: vault `create` events for new `.vh_v3` files now trigger debounced no-op treemap refreshes (excluded from tree anyway). Harmless.
- NIT (observation): transient rename-migration failure on a mobile device with legacy data and NO cached user name → bogus `mobile-user-XXXX` minted PERMANENTLY (first-resolution-wins). Rare compound edge (old-plugin mobile devices have cached names); same risk shape pre-existed.

## Verdict: READY (with 1 #QUESTION_FOR_HUMAN, non-blocking).
