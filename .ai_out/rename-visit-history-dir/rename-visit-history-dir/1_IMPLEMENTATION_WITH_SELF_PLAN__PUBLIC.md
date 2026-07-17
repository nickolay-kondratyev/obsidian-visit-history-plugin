# IMPLEMENTATION — rename `.visit_history` → `__visit_history` (PUBLIC)

## What was done

1. **`VhUserPaths.TOP_DIR = '__visit_history'`** — WHY comment at the constant with the
   Obsidian Sync forum issue URL; class doc reworded (dir is Vault-API visible; exclusion
   now via IsTrackedProvider; all I/O stays on HiddenFileUtil/DataAdapter — no I/O rewire).
2. **`IsTrackedProvider`** excludes BOTH `__visit_history` (new) and legacy `_visit_history`
   in `isTrackedFile` AND `isTrackedView`, DRY'd into one documented private helper
   `isVisitHistoryPath`.
3. **New `VhTopDirRenameMigrationService`** (`src/core/service/migration/`, mirrors
   `VhUserScopeMigrationService`): renames `.visit_history` → `__visit_history` wholesale.
   Both-exist → SKIP (never merge/delete), `console.error` + user-facing notice via the
   injected `UserNotifier` interface (service stays Obsidian-agnostic). Cleanup TODO
   after 2026-October.
4. **`main.ts` wiring**: rename migration runs FIRST in `onload` — before
   `UserNameProviderDefault.getUserName()` and before `VhUserScopeMigrationService`
   (mobile user adoption lists `__visit_history/user`) — in its own try/catch
   never-block-load isolation.
5. **`VhV3ReadmeWriter`**: embedded generated README updated (ASCII tree + legacy bullet)
   plus a new WHY-not-dot-hidden bullet.
6. **Tests**: new `VhTopDirRenameMigrationService.test.ts` (8 cases: clean move, no
   leftover, no-op absent, no-op already-migrated, no notice on clean move, both-exist
   keeps both untouched / notifies user / console.errors); `IsTrackedProvider.test.ts`
   gained `__visit_history` exclusion cases for both methods (incl. the generated README
   `.md` path); hardcoded `.visit_history` literals updated in 5 test files.
   **Failing-first discipline followed** (new tests confirmed red before implementing).
7. **Docs**: AGENTS.md (CLAUDE.md is a symlink to it), docs/README.md,
   docs/visit-history-format.md, docs/architecture.md, README.md — layout renamed, sync
   rationale + issue URL added where the format is described, "invisible to Vault API"
   invariant reworded to IsTrackedProvider enforcement. `docs/tickets/` untouched.

## Key decisions + rationale

- **Constant home**: `IsTrackedProvider` imports `VhUserPaths.TOP_DIR` directly (no new
  `Constants.ts` entry). VhUserPaths stays the single source of truth per CLARIFICATION
  ("URL comment at VhUserPaths.TOP_DIR"); a duplicate constant would violate DRY, and
  VhUserPaths is a dependency-free static path class so the util→service import is benign.
- **Both-exist notification**: the service console.errors a structured line (mirrors the
  existing migration's format) AND calls `userNotifier.showError` with a user-actionable
  message. `UserNotifierDefault.showError` also console.errors — a second log line in
  prod for this rare conflict, accepted for the explicit dual-channel requirement.
- **main.ts creates a `UserNotifierDefault` early** for the migration; `PluginFactory`
  still builds its own (stateless, trivial duplication beats reordering factory wiring).
- Comments in `VhUserScopeMigrationService` now describe post-rename paths
  (`__visit_history/v2|v3 → user/...`) and note that the top-dir rename runs first — the
  service derives from `VhUserPaths.TOP_DIR`, so a very old vault gets BOTH migrations in
  one load, in the right order.

## Verification (actual numbers)

- `npm test`: **36 files, 315 tests passed** (baseline was 305; +10 new) — exit 0.
- `npm run lint`: **0 errors**, 2 pre-existing warnings (main.ts obsidianmd/prefer-active-doc) — exit 0.
- `npm run build`: tsc + esbuild pass — exit 0.

## Files changed

- `src/core/service/visitHistoryService/user/VhUserPaths.ts` — TOP_DIR + comments
- `src/core/util/vault/IsTrackedProvider.ts` (+ test) — dual exclusion
- `src/core/service/migration/VhTopDirRenameMigrationService.ts` (+ test) — NEW
- `src/main.ts` — migration wired first
- `src/core/service/visitHistoryService/v3/VhV3ReadmeWriter.ts` — generated README
- Comment rewording: `HiddenFileUtil.ts`, `HiddenFileUtilDefault.ts`, `VhV3Paths.ts`,
  `UserNameProvider.ts`, `DeviceNameProvider.ts`, `VhUserScopeMigrationService.ts`
- Literal updates in tests: `VhUserScopeMigrationService.test.ts`, `VhV3Paths.test.ts`,
  `VhV3DurationStore.test.ts`, `VhV3DurationRecorder.test.ts`, `UserNameProvider.test.ts`
- Docs: `AGENTS.md` (= CLAUDE.md symlink), `README.md`, `docs/README.md`,
  `docs/architecture.md`, `docs/visit-history-format.md`

## For reviewers to scrutinize

- Ordering in `main.ts.onload` (rename → user name → user-scope move) — mobile user
  adoption correctness depends on it; it is NOT unit-tested (PluginFactory/main wiring is
  the known untested seam per CLAUDE.md).
- The both-exist conflict message wording (user-facing).
- `IsTrackedProvider` prefix check uses `startsWith` — a sibling like
  `__visit_history_notes/` would also be excluded (same pre-existing semantics as the
  legacy `_visit_history` check; not changed).

No #QUESTION_FOR_HUMAN items — CLARIFICATION covered all ambiguities.
