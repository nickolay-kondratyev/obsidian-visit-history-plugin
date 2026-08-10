---
closed_iso: 2026-08-10T17:56:37Z
id: nid_gv6myst2c3kl2qxxnhq60k64d_e
title: Migrate to new name of id library
status: closed
deps: []
links: []
created_iso: '2026-08-10T17:51:26Z'
status_updated_iso: 2026-08-10T17:56:37Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin
---
This has been ran on `obsidian-id-lib` `npm deprecate obsidian-id-lib "renamed to stable-ids-for-obsidian"`

We should switch the dependency of 'obsidian-id-lib' to 'stable-ids-for-obsidian'

## Resolution (2026-08-10)

Migrated the doc-id library dependency from the deprecated `obsidian-id-lib`
to `stable-ids-for-obsidian`.

- **Package swap**: `package.json` dependency `obsidian-id-lib@^0.1.1` →
  `stable-ids-for-obsidian@^0.1.3`; `package-lock.json` regenerated via
  `npm uninstall obsidian-id-lib && npm install stable-ids-for-obsidian`.
- **API-identical rename** (verified): the new package exports the same
  symbols (`DocIdService`, `DocIdServices`, `CrossPluginPathLock`,
  `ID_LOCK_REGISTRY_KEY`, …) and — critically — preserves the cross-plugin
  lock registry key `__obsidian_id_lib_path_lock_registry_v1__`, so the
  cross-plugin same-path serialization contract is unchanged.
- **Source imports**: replaced every `from 'obsidian-id-lib'` (and package-name
  mentions in comments) across `src/` with `stable-ids-for-obsidian`
  (`DocIdFocusListener`, `VhV3FocusDurationListener`, `PluginFactory`,
  `VisitHistoryServiceV3`, `DocIdFilenameSafety`, `DocIdBackfillService` +
  tests, `testSupport/fakes.ts`).
- **Docs**: updated current-state package-name references in `AGENTS.md`
  (== `CLAUDE.md` symlink), `docs/architecture.md`, `docs/how-to-publish.md`.
  The GitHub repo is still named `obsidian-id-lib`
  (`github.com/nickolay-kondratyev/obsidian-id-lib` — confirmed via the new
  package's `repository` field), so repo-URL references were kept as-is; only
  the npm-package name changed. Historical submodule-era notes in
  `docs/migration/extraction-of-id.md` and `docs/tickets/id-lib-*.md` were
  left untouched as past-state records (out of scope).
- **Verification**: `npm run build` ✓, `npm test` (441 passed) ✓,
  `npm run lint` ✓ (0 errors; 1 pre-existing unrelated `setWarning`
  deprecation warning in `ConfirmModal.ts`).
