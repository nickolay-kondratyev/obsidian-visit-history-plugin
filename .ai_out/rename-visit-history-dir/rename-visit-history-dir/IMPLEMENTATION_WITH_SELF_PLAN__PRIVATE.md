# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

## Goal
Rename active VH dir `.visit_history` → `__visit_history` (Obsidian Sync skips dot-folders).

## Plan (checklist)
1. [ ] FAILING TESTS FIRST:
   - New `src/core/service/migration/VhTopDirRenameMigrationService.test.ts`
     (moves dir; no-op when absent; no-op when already migrated; both-exist → skip + notifies + legacy untouched)
   - `IsTrackedProvider.test.ts`: `__visit_history/...` (incl. generated README .md) excluded in isTrackedFile AND isTrackedView; legacy `_visit_history` still excluded.
2. [ ] `VhUserPaths.TOP_DIR = '__visit_history'` + WHY comment w/ forum URL; reword dot-folder rationale.
3. [ ] `IsTrackedProvider`: exclude BOTH legacy `VISIT_HISTORY_TOP_DIR` and `VhUserPaths.TOP_DIR` (private helper to DRY the two methods). DECISION: IsTrackedProvider imports VhUserPaths directly — VhUserPaths.TOP_DIR stays the single source of truth (CLARIFICATION says URL comment lives there); no duplicate Constants entry.
4. [ ] New `VhTopDirRenameMigrationService` (mirror VhUserScopeMigrationService): ctor(hiddenFileUtil, userNotifier: UserNotifier). If `.visit_history` absent → no-op. If `__visit_history` exists too → userNotifier.showError (showError does console.error + Notice — satisfies both channels), keep legacy. Else hiddenFileUtil.rename. TODO cleanup after 2026-October.
5. [ ] `main.ts`: wire new migration FIRST (before getUserName + VhUserScopeMigrationService), own try/catch never-block-load. Create `UserNotifierDefault(this)` early for it (factory still builds its own — stateless, fine).
6. [ ] `VhV3ReadmeWriter` README_CONTENT: `.visit_history/` → `__visit_history/`; mention sync rationale briefly.
7. [ ] Update hardcoded `.visit_history` literals in tests: VhUserScopeMigrationService.test.ts, VhV3Paths.test.ts, VhV3DurationStore.test.ts, VhV3DurationRecorder.test.ts, UserNameProvider.test.ts.
8. [ ] Reword comments: HiddenFileUtil.ts (dot-folder WHY — keep DataAdapter I/O, works for visible dirs too), VhV3Paths.ts, UserNameProvider.ts (5, 65), main.ts:21, VhUserScopeMigrationService.ts docs (paths now under __visit_history; note dir-rename runs first), DeviceNameProvider.ts.
9. [ ] Docs: CLAUDE.md + AGENTS.md (mirror!), docs/README.md, docs/visit-history-format.md, docs/architecture.md, README.md. Add sync rationale + URL where layout described; fix "invisible to Vault API" invariant → enforced by IsTrackedProvider. Do NOT touch docs/tickets/.
10. [ ] `npm test`, `npm run lint`, `npm run build` (output → .tmp/). Commit at milestones.
11. [ ] Write PUBLIC.md, update this file, final commit.

## Key facts / gotchas
- `"__visit_history".startsWith("_visit_history")` is FALSE — legacy exclusion does NOT cover the new dir.
- Ordering: rename migration MUST run before username resolution (mobile adopts user from `__visit_history/user` listing; wrong order mints bogus mobile-user).
- FakeHiddenFileUtil.rename throws if dest exists; folders implied by files.
- UserNotifier.showError = console.error + Notice (covers both CLARIFICATION channels).
- No FakeUserNotifier exists in testSupport — use inline recording fake in migration test.
- VaultUtil.ts has no `.visit_history` mention (exploration was slightly off); only `_visit_history`-related comment maybe.

## State — COMPLETE (2026-07-16)
- All plan steps done. 315/315 tests pass, lint 0 errors (2 pre-existing warnings), build green.
- Commits on branch rename-visit-history-dir:
  1. core rename + migration + tracking exclusion (+tests)
  2. comment rewording + generated README
  3. docs (AGENTS.md/CLAUDE.md symlink!, README.md, docs/*)
  4. .ai_out artifacts (this + PUBLIC)
- Gotchas discovered while executing:
  - **CLAUDE.md is a SYMLINK to AGENTS.md** — edit AGENTS.md only (Edit tool refuses symlinks).
  - **Bash `node`/`npm`/`npx` are broken shell functions** (failed NVM shim in profile) —
    use `/usr/local/bin/npm` full path.
  - VaultUtil.ts had no `.visit_history` mention (exploration list slightly off).
  - Remaining intentional `.visit_history` literals: VhTopDirRenameMigrationService(+test),
    VhUserPaths WHY comment, VhV3ReadmeWriter legacy bullet, migration-history doc sections.
- Decision log: IsTrackedProvider imports VhUserPaths directly (no Constants dup);
  service console.errors AND calls userNotifier.showError (Default also logs → double
  line in prod conflict case, accepted); main.ts builds its own early UserNotifierDefault.
