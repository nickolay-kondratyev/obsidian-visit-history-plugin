# IMPLEMENTATION — extract-id-lib / move-id-out

Implementer: IMPLEMENTATION, 2026-07-16. Plan followed: `DETAILED_PLANNING__PUBLIC.md` (as amended inline by PLAN_REVIEWER).

## Status: COMPLETE — all phases implemented, all verification green.

## What was implemented (per plan phase)

### Phase 0 — Baseline
- Recorded green baseline: 39 test files / 336 tests, build 0, lint 0 errors (2 pre-existing `prefer-active-doc` warnings — unchanged after the work).

### Phase 1 — Library scaffold (submodule `submodules/obsidian-id-lib`, own repo)
- `package.json` (name `obsidian-id-lib`, private, `main`/`types` → `src/index.ts`, scripts `test`/`check`, peerDep `obsidian`, devDeps typescript/vitest/obsidian), strict `tsconfig.json` mirroring the plugin, `vitest.config.ts` with the `obsidian` → mock alias, `.gitignore`, lib `package-lock.json` committed.
- `src/testSupport/`: `obsidianMock.ts` (trimmed to `TAbstractFile`/`TFile`), `fileFactory.ts` (`makeTFile`, verbatim), `FakeFileContentAccess.ts` (trimmed `FakeNoteFileUtil`: seedNote/getContent/cachedRead/process + call counters), `ContentSwappingFileContentAccess.ts` (simulates a concurrent writer for re-check tests).
- Submodule commit: `a867be8`.

### Phase 2 — Code move + lock (submodule)
- Moved essentially verbatim (only `NoteFileUtil` → `FileContentAccess` seam + `[VHP]` → `[obsidian-id-lib]` log prefix; every WHY/WHY-NOT comment preserved): `DocIdStore.ts`, `DocIdGenerator.ts`, `FrontmatterDocIdStore.ts`, `CanvasDocIdStore.ts`, `DocIdService.ts` + the four test files.
- NEW `FileContentAccess.ts` (2-method interface + `VaultFileContentAccess(vault)`).
- NEW `CrossPluginPathLock.ts` — exactly the D3 algorithm: `ID_LOCK_REGISTRY_KEY = '__obsidian_id_lib_path_lock_registry_v1__'`, plain `Map<string, Promise<unknown>>` on a `registryHost` (default `globalThis`), chain-off-tail acquire with predecessor-rejection swallow, never-rejecting stored tail, `=== next` cleanup guard, no expiry.
- `DocIdServiceDefault` gained the REQUIRED third ctor param `pathLock: PathLock`; `ensureDocId` runs `store.ensureId(file)` under `runExclusive(file.path, …)` (dispatch null-check outside the lock); `getDocId`/`isEligible` untouched (lock-free).
- NEW `DocIdServices.createDefault(vault)` static factory (private ctor); `index.ts` barrel with `export type` for type-only exports.
- Tests: full lock suite `CrossPluginPathLock.test.ts` (AC-L1..L7 incl. two-instances-one-host rendezvous and foreign pending/rejecting tails), `DocIdServices.lock.test.ts` (AC-S1 md + canvas two-plugin races → one write/one id; AC-S2 getDocId leaves the host key-free), `DocIdService.test.ts` extended (AC-S3 lock delegation by path, lock untouched for unsupported ext, getDocId never touches the lock), and NEW re-check backstop tests in both store suites (AC-B7 — was not explicitly covered before the move).
- Submodule commit: `c94e016`. Lib verification: `npm run check` 0, `npm test` 6 files / 69 tests green (52 moved + 17 new).

### Phase 3 — Plugin rewire (parent repo)
- `package.json`: + `"obsidian-id-lib": "file:submodules/obsidian-id-lib"`, − `"ulid"`, + script `"test:lib"`. Lockfile refreshed; npm symlinks `node_modules/obsidian-id-lib → ../submodules/obsidian-id-lib`.
- Deleted the 9 moved files from `src/core/service/docId/` (directory now holds `DocIdBackfillService` + its two tests only).
- Imports retargeted to `'obsidian-id-lib'`: `PluginFactory.ts` (wiring is now `this.docIdService = DocIdServices.createDefault(app.vault);`), `DocIdFocusListener.ts` + test, `VhV3FocusDurationListener.ts`, `VisitHistoryServiceV3.ts`, `DocIdBackfillService.ts` + unit test, `testSupport/fakes.ts`.
- `DocIdBackfillService.integration.test.ts` now imports REAL lib classes through `'obsidian-id-lib'` and constructs `DocIdServiceDefault(…, new CrossPluginPathLock({}))` — `FakeNoteFileUtil` passes structurally as `FileContentAccess` (AC-P3, consumer-side seam proof).
- `eslint.config.mts`: `'submodules'` added to `globalIgnores`.
- Parent commit: `9a24c64`. The vitest-externalization fallback (`server.deps.inline`) was NOT needed — the symlinked dep transforms fine with the alias.

### Phase 4 — Documentation
- Lib README rewritten (usage one-liner + DI form, id-format contract, window-key compatibility contract + protocol, guarantees, consumption, dev). Anchor points minted with `anchor_point_create`: `ap_iZAE3fAcs5zXIWrTiIdx3_E` (id format) and `ap_e7fWGWziwxrLmnegjIYKX_E` (window key) live in the README; `ref.`s from `DocIdGenerator.ts`, `CrossPluginPathLock.ts`, the design brief, and the plugin's `DocIdFilenameSafety.ts`. Submodule commit: `85d9ed5`.
- `docs/migration/extraction-of-id.md`: marked IMPLEMENTED with lib pointer; §Solution.2 → docid format + existing-ids-honored; §Solution.3 → raw-text `Vault.process` + in-transform re-check with the WHY-NOT-processFrontMatter rationale; §API surface → DI classes + facade; final window key + Map shape recorded.
- `CLAUDE.md` (via its symlink target `AGENTS.md`): tree entry (docId/ = backfill only + lib pointer), new extraction/lock design bullet, deps line (ulid → obsidian-id-lib submodule), dev-env (`git submodule update --init`, `npm run test:lib`).
- `docs/architecture.md`: component tree + "Doc id flow" show the lib boundary and the lock step. `docs/README.md` skimmed — no change needed.
- Plugin `README.md`: clone with `--recurse-submodules`.
- Parent commit: `2726a18`.

### Phase 5 — Final verification
| Check | Result |
|---|---|
| lib `npm run check` | exit 0 |
| lib `npm test` | 6 files / 69 tests, all pass |
| plugin `npm run build` | exit 0 |
| plugin `npm test` | 35 files / 284 tests, all pass (336 baseline − 52 moved = 284; nothing dropped — AC-P2) |
| plugin `npm run lint` | 0 errors (same 2 pre-existing warnings as baseline — AC-P4) |
| `npm run test:lib` from plugin root | exit 0, 69 tests |
| `main.js` contains `__obsidian_id_lib_path_lock_registry_v1__` | yes (AC-P1) |
| `ulid` in package.json / package-lock.json / src | absent (AC-P5) |
| stale `service/docId/DocIdService|Store|Generator|…Store` imports | none |

## Commits

Submodule (`submodules/obsidian-id-lib`, branch `main`):
- `a867be8` Scaffold obsidian-id-lib
- `c94e016` Move doc-id code; add cross-plugin per-path window lock
- `85d9ed5` README: usage, window-lock contract, id format contract

Parent (`move-id-out`):
- `9a24c64` Consume obsidian-id-lib; add cross-plugin path lock; drop unused ulid
- `2726a18` Docs: doc-id library extraction + cross-plugin lock

**NOT pushed** (per instructions — human decides). HANDOFF CAVEAT: the submodule's `main` (now at `85d9ed5`) MUST be pushed to `git@github.com:nickolay-kondratyev/obsidian-id-lib.git` before (or when) the parent branch is pushed/shared, or the parent will reference an unreachable SHA.

## Deviations from plan (all minor, with rationale)
1. **Added AC-B7 re-check backstop tests** (one per store) + the `ContentSwappingFileContentAccess` test helper: the plan asserted the re-check was "covered by the moved store tests", but no pre-existing test exercised the concurrent-modification window — added rather than leaving the AC unmet. NOTE: the canvas test asserts content preservation only, because `CanvasDocIdStore.ensureId` returns the GENERATED id even when the re-check kept a concurrent one (pre-existing behavior, preserved; see follow-ups).
2. **Test-local variable rename** `noteFileUtil` → `fileAccess` in moved store tests (matches the new seam type; substance unchanged).
3. Lib `package-lock.json` committed (reproducible lib dev env); plan didn't specify.
4. `CLAUDE.md` edits were made in `AGENTS.md` — `CLAUDE.md` is a symlink to it.

## Follow-up ticket candidates (out of scope, not fixed)
1. **Lib ESLint**: obsidian-id-lib has no ESLint yet (noted in its README; typescript-eslint may flag the static-only `DocIdServices` when added).
2. **Canvas ensureId return-value nuance**: when the in-transform re-check finds a concurrently-written id, `CanvasDocIdStore.ensureId` still returns the (unwritten) generated id, while `FrontmatterDocIdStore` returns the concurrent id. Behavior preserved as-is per the mandate; worth aligning in the lib later.
3. **Dev-container env**: the interactive shell's `npm` function is broken (`__actual_NVM_source` fails — no `~/.nvm/nvm.sh`); `/usr/local/bin/npm` works. Env fix ticket, not a repo issue.
4. Pre-existing adjacent ticket `docs/tickets/retry-doc-id-on-modify.md` untouched; the lib API does not preclude it.
