---
closed_iso: 2026-08-12T23:38:04Z
session_ids: [{"a": "claude", "type": "execution", "id": "24b7fe47-bc55-4bf1-aa02-c4786b8fc008"}, {"a": "claude", "type": "review", "id": "d1880cdd-38c3-413c-b1a4-fdcbca3f1ab8"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_9ebr4ouaipn4dtylfo0puycoo_e
title: "HiddenFileUtil: add file listing and empty-dir removal APIs"
status: closed
deps: [nid_i6zq59oey3pbggvog9kj3dj8x_e]
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e, nid_3dy6j77ekkmv2nmgsnqu959ks_e, nid_fdlst01268tcjvtfs4aga34ov_e, nid_7hpz3mw6bg68k41eomug4nt0j_e]
created_iso: 2026-08-12T23:22:37Z
status_updated_iso: 2026-08-12T23:38:04Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [migration_to_plugin_data_dir]
---

Prerequisite for the `.plugin_data/visit_history` migration. Plan: nid_i6zq59oey3pbggvog9kj3dj8x_e. Follow-ups on this topic: tag `migration_to_plugin_data_dir`.

## What
`src/core/util/file/hidden/HiddenFileUtil.ts` (interface) + `src/core/util/file/hidden/impl/HiddenFileUtilDefault.ts` (DataAdapter impl) currently offer only: readIfExists, write, append, listSubfolderNames, exists, rename. The upcoming migration needs to (a) enumerate FILES in a folder and (b) delete empty folders. Add:

1. `listFileNames(folderPath: string): Promise<string[]>` — basenames of direct FILES in the folder; `[]` if the folder does not exist. Impl via `adapter.list(normalizePath(folderPath))` -> `ListedFiles.files` (full paths; take basenames), mirroring the existing `listSubfolderNames`.
2. `removeFolderIfEmpty(folderPath: string): Promise<boolean>` — deletes the folder ONLY if it contains no files and no subfolders; returns whether it was removed; no-op (false) if the folder is absent or non-empty. Impl via `adapter.list` check + `adapter.rmdir(path, false)` (non-recursive — safety backstop: even on a racing write, never deletes content). Explicitly NOT a recursive delete — keep destructive surface minimal.

## Also
- Update `src/testSupport/` FakeHiddenFileUtil with matching behavior.
- Unit tests (vitest, GIVEN/WHEN/THEN, mirrored test files): empty dir, dir with files only, dir with subfolders only, absent dir, removal returns true and dir no longer exists.
- Follow existing code style of HiddenFileUtilDefault (normalizePath usage, succinct interface docs).

## Acceptance Criteria

New interface methods + default impl + fake + unit tests; npm test and npm run lint clean.

## Resolution

Done. Both APIs added exactly as specified.

- `HiddenFileUtil.ts` — added `listFileNames(folderPath): Promise<string[]>` and
  `removeFolderIfEmpty(folderPath): Promise<boolean>` with succinct interface docs.
- `impl/HiddenFileUtilDefault.ts`:
  - `listFileNames` mirrors `listSubfolderNames` — exists-guard → `adapter.list(normalizePath(...))`
    → `listed.files` basenames; `[]` when absent.
  - `removeFolderIfEmpty` — exists-guard (false if absent) → `adapter.list`; returns false
    when `files.length > 0 || folders.length > 0`; otherwise `adapter.rmdir(path, false)`
    (non-recursive backstop) and returns true.
- `testSupport/FakeHiddenFileUtil.ts` — `listFileNames` returns direct-file basenames (no
  further slash after the folder prefix). `removeFolderIfEmpty` always returns false: the
  fake models folders as implied by the files under them, so an empty folder is
  indistinguishable from an absent one — consistent with the false-on-absent contract.
  Param named `_folderPath` to satisfy no-unused-vars. NOTE for the migration work: if a
  consumer needs to assert a *successful* empty-dir removal against the fake, the fake will
  need an explicit folder set (it has none today) — real-impl coverage lives in the
  mirrored default test instead.
- `impl/HiddenFileUtilDefault.test.ts` — added `rmdir` to the in-memory FakeAdapter; new
  `describe` blocks for `listFileNames` (files-not-subfolders, absent) and
  `removeFolderIfEmpty` (empty→true, gone-after, files→false + intact, subfolders→false,
  absent→false).

Verified: `npm test` → 462 passed; `npm run lint` → 0 errors (1 pre-existing unrelated
deprecation warning in ConfirmModal.ts).

