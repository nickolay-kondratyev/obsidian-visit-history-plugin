---
session_ids: [{"a": "claude", "type": "execution", "id": "24b7fe47-bc55-4bf1-aa02-c4786b8fc008"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_9ebr4ouaipn4dtylfo0puycoo_e
title: "HiddenFileUtil: add file listing and empty-dir removal APIs"
status: in_progress
deps: [nid_i6zq59oey3pbggvog9kj3dj8x_e]
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e, nid_3dy6j77ekkmv2nmgsnqu959ks_e, nid_fdlst01268tcjvtfs4aga34ov_e, nid_7hpz3mw6bg68k41eomug4nt0j_e]
created_iso: 2026-08-12T23:22:37Z
status_updated_iso: 2026-08-12T23:36:10Z
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

