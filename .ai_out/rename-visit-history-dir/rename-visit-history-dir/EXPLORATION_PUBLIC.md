# EXPLORATION: rename `.visit_history` → `__visit_history`

## Key facts

- **Single source of truth for the ACTIVE dir**: `VhUserPaths.TOP_DIR = '.visit_history'` at `src/core/service/visitHistoryService/user/VhUserPaths.ts:18`. Everything active derives from it:
  - `VhUserPaths.USERS_DIR = '${TOP_DIR}/user'` (line 19), `VhUserPaths.userRootDir()` (line 22).
  - `VhV3Paths` (`src/core/service/visitHistoryService/v3/VhV3Paths.ts`) composes all v3 paths from `VhUserPaths.userRootDir()` — never hardcodes the root.
  - `VhUserScopeMigrationService` uses `VhUserPaths.TOP_DIR` (line 43) and `VhUserPaths.userRootDir()` (line 47).
  - `UserNameProvider` (mobile branch) and `VhV3DurationStore` read `VhUserPaths.USERS_DIR`.
  - So a **one-line change to `VhUserPaths.TOP_DIR`** flips the entire active path layout. There is NO duplicated string literal for the active dir in production code paths (only in comments/docs/tests).

- **`_visit_history` (single underscore) is a DIFFERENT, LEGACY V1 constant** — do not confuse with the target `__visit_history`:
  - `Constants.ts:9` `export const VISIT_HISTORY_TOP_DIR = "_visit_history";` — legacy V1, left on disk, only used for TRACKING EXCLUSION in `IsTrackedProvider`.
  - `ARCHIVE_DIR_NAME = "_archive"` (`Constants.ts:16`) — unrelated heatmap archive feature.

- **WHY dot-folder + HiddenFileUtil** (`src/core/util/file/hidden/HiddenFileUtil.ts:1-11`, `VhUserPaths.ts:13-16`): Obsidian's Vault API (`getFiles`, `getAbstractFileByPath`, `create`, `metadataCache`) does NOT see dot-folders. All active VH I/O goes through `HiddenFileUtilDefault` (DataAdapter, `src/core/util/file/hidden/impl/HiddenFileUtilDefault.ts`). This is why `.visit_history` files never appear in search/graph/backlinks AND never get self-tracked or shown in the heatmap.

## Critical implication: `__visit_history` becomes VISIBLE to the Vault API

`__visit_history` is NOT a dot-folder, so `vault.getFiles()` WILL enumerate its contents. Tracking/heatmap flows into it unless explicitly excluded:

- Heatmap/tracking entry point: `VaultUtilDefault.getTrackedTFiles()` = `app.vault.getFiles().filter(isTrackedProvider.isTrackedFile)` (`src/core/util/vault/VaultUtil.ts:40-43`). `getTrackedFiles()` feeds `buildVaultTree` (`src/viewModel/buildVaultTree.ts`), which just groups the already-filtered files. So the ONLY gate is `IsTrackedProvider`.
- `IsTrackedProviderDefault` (`src/core/util/vault/IsTrackedProvider.ts:12,34`) excludes only paths where `file.path.startsWith(VISIT_HISTORY_TOP_DIR)` i.e. `"_visit_history"`.
- **`"__visit_history".startsWith("_visit_history")` is FALSE** (index 1 differs: `_` vs `v`). Therefore `__visit_history` files would NOT be auto-excluded and WOULD show up in the heatmap and be tracked (though the tracked extensions are only md/canvas/excalidraw; `.vh_v3` files are excluded by extension anyway — see `TRACKED_EXTENSIONS` in `Constants.ts:2`).
  - Note: the generated README at `__visit_history/user/<user>/v3/README__generated__vh_v3_format.md` IS a `.md` file → it WOULD be tracked and appear in the heatmap. This is a concrete regression to guard against.
- **Required change**: add `__visit_history` (the new `VhUserPaths.TOP_DIR`) to the tracking exclusion in `IsTrackedProvider` (both `isTrackedFile` and `isTrackedView`). Simplest: exclude paths starting with `VhUserPaths.TOP_DIR` in addition to the legacy `VISIT_HISTORY_TOP_DIR`. Consider whether `IsTrackedProvider` should import `VhUserPaths.TOP_DIR` or a new Constants entry (currently it only imports from `Constants.ts`).
- `pruneArchiveFolders` (`src/viewModel/pruneArchiveFolders.ts`) matches only the exact name `_archive`, so it does NOT interact with `__visit_history`. And since `__visit_history` should be excluded upstream at `IsTrackedProvider`, it never reaches `buildVaultTree`/prune anyway.

## Migration pattern (template) — `VhUserScopeMigrationService`

`src/core/service/migration/VhUserScopeMigrationService.ts`:
- Detects legacy dirs via `hiddenFileUtil.exists(legacyDir)`, moves via `hiddenFileUtil.rename(from, to)` (whole subtree).
- **Never merges / never deletes**: if destination exists, logs `console.error` and leaves legacy in place (lines 48-53).
- Runs in `main.ts:26-33` inside try/catch (never blocks load), AFTER `UserNameProviderDefault.getUserName()` (line 25) because it needs the username to compute the destination.
- Has a documented cleanup TODO (after 2026-October).
- Tests: `src/core/service/migration/VhUserScopeMigrationService.test.ts` using `FakeHiddenFileUtil` — covers move, no-leftover, both v2/v3, no-op, destination-exists-keeps-legacy, partial migration.

**DataAdapter supports folder move**: `HiddenFileUtilDefault.rename` (`impl/HiddenFileUtilDefault.ts:53-63`) wraps `app.vault.adapter.rename`, calls `ensureParentFolders(to)`, and THROWS if destination exists (it does not merge). `FakeHiddenFileUtil.rename` (`src/testSupport/FakeHiddenFileUtil.ts:45-59`) mirrors this (subtree move, throws on existing dest). So the same `rename` primitive is available for the new dir-level migration.

## Path composition summary

- `VhUserPaths` — owns root `TOP_DIR` and `userRootDir()`.
- `VhV3Paths` — v3 file/dir/readme paths, all from `VhUserPaths.userRootDir()`.
- `VhV3DurationStore` (`src/core/service/visitHistoryService/v3/VhV3DurationStore.ts:69`) — enumerates users via `VhUserPaths.USERS_DIR`; per-file paths via `VhV3Paths`.
- `VhV3ReadmeWriter` (`src/core/service/visitHistoryService/v3/VhV3ReadmeWriter.ts`) — writes README to `VhV3Paths.readmePath()`; ALSO contains a hardcoded `.visit_history/` ASCII tree in `README_CONTENT` (lines 12, 23-24) that must be updated to `__visit_history/`.
- `UserNameProvider` mobile branch (`UserNameProvider.ts:98`) — lists `VhUserPaths.USERS_DIR` to adopt an existing single user.

## Edge cases to flag

1. **Both `.visit_history` and `__visit_history` exist**: `rename` throws / must be guarded. Follow the existing template: check `exists(dest)` first; if present, keep `.visit_history`, log `console.error`, never merge, never delete. (Happens when another synced device already migrated.)
2. **onload ORDERING (important divergence from existing migration)**: The new dir-rename migration does NOT need the username, and the mobile `UserNameProvider` resolves by listing `VhUserPaths.USERS_DIR` (which becomes `__visit_history/user`). If the rename runs AFTER username resolution, a mobile device with only `.visit_history` data present would see an empty `__visit_history/user`, fail to adopt the existing user, and mint a random `mobile-user-XXXX`. So the new `.visit_history → __visit_history` rename should run FIRST in `main.ts.onload` — before `getUserName()` (line 25) and before `VhUserScopeMigrationService` (line 28). Desktop is unaffected (username from OS), but mobile correctness depends on this ordering.
3. **Mobile vs desktop**: `adapter.rename` is used elsewhere and assumed cross-platform; `ensureParentFolders` for a top-level dest is a no-op (no parent). No Node builtins involved. Should be fine on both.
4. **`_archive` / underscore-prefix**: no generic underscore-prefix logic exists; `pruneArchiveFolders` is exact-match `_archive` only. No interaction.
5. **Interaction of the two migrations**: after the dir rename, the existing `VhUserScopeMigrationService` (which moves `TOP_DIR/v2|v3` under the user) operates on the NEW `__visit_history` root automatically (it derives from `VhUserPaths.TOP_DIR`). So a very old vault could need BOTH: dir rename then user-scope move — ordering (rename first) handles this.
6. **Legacy `_visit_history` (V1) is untouched** by all of this and remains excluded via `IsTrackedProvider` — keep that exclusion.

## Tracking-exclusion tests that encode current behavior

- `src/core/util/vault/IsTrackedProvider.test.ts:26-27,53` — asserts `_visit_history/...` is not tracked. Would want NEW cases asserting `__visit_history/...` (including a `.md` like the README) is not tracked once exclusion is added.
- `src/core/util/vault/VaultUtil.test.ts:29` — uses `_visit_history/x.md` as the excluded example.

## Test/doc files referencing `.visit_history` (need string updates on rename)

Production/tests using literal `.visit_history` (mostly via constants, but some hardcoded literals in tests):
- `src/core/service/migration/VhUserScopeMigrationService.test.ts:7-10,41` (hardcoded `.visit_history/...` literals).
- `src/core/service/visitHistoryService/v3/VhV3Paths.test.ts:8,15` (asserts exact `.visit_history/...` strings).
- `src/core/service/visitHistoryService/v3/VhV3DurationStore.test.ts:8,95-96,107,119,154`.
- `src/core/focusDuration/VhV3DurationRecorder.test.ts:10`.
- `src/core/service/visitHistoryService/user/UserNameProvider.test.ts:43-45`.
- These will auto-track the new value only if they reference `VhUserPaths`/`VhV3Paths`; where they hardcode the literal string they must be edited.

Comments / docs referencing `.visit_history` (update for accuracy):
- `src/main.ts:21` (comment).
- `src/core/service/migration/VhUserScopeMigrationService.ts:7-8,24,31` (comments).
- `src/core/service/visitHistoryService/v3/VhV3ReadmeWriter.ts:12,23-24` (embedded README_CONTENT — user-visible!).
- `src/core/service/visitHistoryService/user/VhUserPaths.ts:5,21` and `UserNameProvider.ts:5,65`, `VhV3Paths.ts:7-8`, `DeviceNameProvider.ts:8`, `HiddenFileUtil.ts:2,10`, `VaultUtil.ts:20`.
- Docs: `docs/README.md:10-13`, `docs/visit-history-format.md:6-7,15,92,94,105`, `docs/architecture.md:35,56,110,212-213,215`, `README.md:10,12,15,17`, `AGENTS.md:3,65,136-138`, `CLAUDE.md:3,65,136-138`, `docs/tickets/1_must-add-user-id.md:3,5`.
- Note: the HiddenFileUtil dot-folder rationale comments (`HiddenFileUtil.ts:1-11`, `VhUserPaths.ts:13-16`, `AGENTS.md`/`CLAUDE.md` line 136) become INACCURATE after the rename — `__visit_history` is NOT hidden from the Vault API. These need rewording, and the "invisible → never self-tracked" invariant (`docs/visit-history-format.md:104-106`) is now enforced by `IsTrackedProvider` instead of by invisibility. The task also asks to put the Obsidian-sync issue URL into a comment at the constant's file (`VhUserPaths.ts`).

## Open questions / ambiguities for CLARIFICATION

1. **Naming/constant home**: Should `TOP_DIR` stay on `VhUserPaths`, or should the active top-dir name move into `Constants.ts` (next to `VISIT_HISTORY_TOP_DIR`) so `IsTrackedProvider` can import it without depending on the service layer? (Currently `IsTrackedProvider` imports only from `Constants.ts`.)
2. **Exclusion breadth**: Exclude by exact `VhUserPaths.TOP_DIR` prefix, or keep excluding legacy `_visit_history` too (recommended: both)? Confirm the README `.md` under `__visit_history` must be excluded from the heatmap.
3. **Migration cleanup horizon**: Should the new `.visit_history → __visit_history` migration carry the same "delete after 2026-October" TODO, or a later date (it is a fresh 2026-07 migration)?
4. **onload ordering**: Confirm the new rename runs FIRST (before username resolution and before `VhUserScopeMigrationService`) to preserve mobile user adoption. Should it share the same try/catch isolation?
5. **Both-exist policy**: Confirm "keep `.visit_history`, log error, never merge/delete" mirrors the existing service (recommended).
6. **Existing `.visit_history` invisibility guarantees**: Any downstream that RELIED on VH files being invisible to search/graph/metadata now loses that for `__visit_history`. Owner should confirm that VH data becoming visible to the Vault API (and appearing in file explorer, quick-switcher, search unless otherwise hidden) is acceptable — this is the fundamental tradeoff of the change (visible so Obsidian Sync syncs it).

## Suggested change surface (no code written)

- `src/core/service/visitHistoryService/user/VhUserPaths.ts` — change `TOP_DIR` to `'__visit_history'`; add the Obsidian-sync issue URL comment; reword the "dot-folder invisible" rationale.
- `src/core/util/vault/IsTrackedProvider.ts` — add exclusion for the new `__visit_history` prefix (both methods).
- New migration service `src/core/service/migration/` (mirror `VhUserScopeMigrationService`) to move `.visit_history` → `__visit_history`; new tests mirroring its test file.
- `src/main.ts` — wire the new migration FIRST in onload (before username resolution and the existing migration).
- `src/core/service/visitHistoryService/v3/VhV3ReadmeWriter.ts` — update embedded README ASCII tree/text.
- `IsTrackedProvider.test.ts`, `VaultUtil.test.ts` — add `__visit_history` exclusion cases (incl. the README `.md`).
- Update hardcoded `.visit_history` literals in the test files listed above.
- Update comments/docs (`docs/*`, `README.md`, `AGENTS.md`, `CLAUDE.md`) and correct the now-inaccurate "hidden/invisible" invariants.
