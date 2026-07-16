# IMPLEMENTATION private memory — extract-id-lib / move-id-out

## State: DONE. All plan phases 0–5 implemented, verified, committed. Nothing pending except human-owned pushes.

## Environment gotchas (critical for a rehydrated clone)
- The shell's `npm` is a FUNCTION that fails (`__actual_NVM_source` → missing ~/.nvm/nvm.sh). ALWAYS use `/usr/local/bin/npm`. `node` at `/usr/local/bin/node` is fine.
- Every Bash call sources a noisy profile — ignore the boilerplate; cwd resets between calls, use absolute paths.
- `CLAUDE.md` at repo root is a SYMLINK to `AGENTS.md` — edit AGENTS.md (Write/Edit tools refuse the symlink path).
- `anchor_point_create` bash function exists and works.

## Key facts / decisions taken
- Baseline: 39 files/336 tests. After: plugin 35/284, lib 6/69 (52 moved + 17 new). Lint: 0 errors, 2 pre-existing prefer-active-doc warnings in PluginFactory (lines shifted to ~83/87 → now ~80/84 area; still warnings, not errors).
- Lock implemented exactly per plan D3; registry host ctor param `object = globalThis`; boundary casts confined to `getOrCreateRegistry` (documented as system-boundary).
- `DocIdServiceDefault` third REQUIRED param pathLock. Factory `DocIdServices.createDefault(vault)` (Vault, not App — reviewer-flagged deviation from CLARIFICATION Q3 wording, human-visible in plan).
- Lib obsidianMock trimmed to TAbstractFile+TFile. FakeFileContentAccess keeps method name `seedNote`.
- AC-B7 wasn't actually covered by pre-move tests → added ContentSwappingFileContentAccess (testSupport) + one re-check test per store. Canvas store's ensureId RETURNS newId even when re-check bails (pre-existing quirk; test asserts content only; follow-up ticket noted in PUBLIC).
- vitest in the plugin transforms the symlinked lib fine (alias applies); `server.deps.inline` fallback NOT needed.
- eslint `globalIgnores` got `'submodules'`.
- ulid removed everywhere (verified package.json, lockfile, src).
- Anchor points: window key `ap_e7fWGWziwxrLmnegjIYKX_E`, id format `ap_iZAE3fAcs5zXIWrTiIdx3_E` — anchored as HTML comments in lib README sections; refs in lib DocIdGenerator.ts + CrossPluginPathLock.ts headers, plugin DocIdFilenameSafety.ts, design brief.

## Commits
- Submodule main: 7ece9a3 (initial, pre-existing) → a867be8 (scaffold) → c94e016 (code+lock) → 85d9ed5 (README). Remote origin = git@github.com:nickolay-kondratyev/obsidian-id-lib.git — NOT pushed.
- Parent move-id-out: 9a24c64 (rewire, includes pointer c94e016) → 2726a18 (docs, includes pointer 85d9ed5). NOT pushed.
- Push order: submodule BEFORE parent (else unreachable SHA for others).

## Files of interest
- Lib: submodules/obsidian-id-lib/src/{index,DocIdService,DocIdStore,DocIdGenerator,FrontmatterDocIdStore,CanvasDocIdStore,FileContentAccess,CrossPluginPathLock,DocIdServices}.ts + tests + testSupport/.
- Plugin touched: package.json, package-lock.json, eslint.config.mts, PluginFactory.ts, DocIdFocusListener.ts(+test), VhV3FocusDurationListener.ts, VisitHistoryServiceV3.ts, fakes.ts, DocIdBackfillService.ts(+2 tests), DocIdFilenameSafety.ts, AGENTS.md, README.md, docs/architecture.md, docs/migration/extraction-of-id.md.
- settingsTab/VisitHistorySettingTab.ts untouched (backfill stayed in plugin).

## If re-verifying
```
cd <repo> && /usr/local/bin/npm run build && /usr/local/bin/npm test && /usr/local/bin/npm run lint && /usr/local/bin/npm run test:lib
cd submodules/obsidian-id-lib && /usr/local/bin/npm run check && /usr/local/bin/npm test
grep -c __obsidian_id_lib_path_lock_registry_v1__ main.js   # expect 1
```
