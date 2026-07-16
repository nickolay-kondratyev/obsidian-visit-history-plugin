# IMPLEMENTATION REVIEW — extract-id-lib / move-id-out

Reviewer: IMPLEMENTATION_REVIEWER, 2026-07-16. Reviewed against `DETAILED_PLANNING__PUBLIC.md`, `CLARIFICATION__PUBLIC.md`, `EXPLORATION__PUBLIC.md`, and the implementation report — every claim independently verified (builds/tests re-run, code read line-by-line, moved files diffed against `9a24c64^` originals).

## Verdict: **READY — ITERATION CAN BE SKIPPED**

No BLOCKING or MAJOR issues found. Lock algorithm is exactly per spec; behavior preservation is verbatim; all verification independently reproduced green; docs/README accurate; git hygiene clean.

## Verification runs (re-run by reviewer, not trusted from report)

Note: the interactive shell's `npm` wrapper is broken in this dev container (missing nvm — pre-existing env issue, already ticketed by implementer); `/usr/local/bin/npm` used directly. Logs in `.tmp/rev_*.log`.

| Check | Result |
|---|---|
| plugin `npm run build` | exit 0 |
| plugin `npm test` | exit 0 — 35 files / **284 tests passed** |
| plugin `npm run lint` | exit 0 — 0 errors, 2 pre-existing `prefer-active-doc` warnings (matches baseline) |
| `npm run test:lib` | exit 0 — 6 files / **69 tests passed** |
| lib `npm run check` (tsc -noEmit, strict) | exit 0 |
| `main.js` contains `__obsidian_id_lib_path_lock_registry_v1__` | yes (1 hit) — lib bundles in (AC-P1) |
| `main.js` committed? | NOT tracked (correct) |
| `ulid` in package.json / package-lock.json / src | absent — verified with correct grep exit codes (AC-P5) |
| stale imports of old `service/docId/{Service,Store,Generator,FrontmatterStore,CanvasStore}` paths | none (AC) |
| test math | 336 baseline − 52 moved = 284 plugin; 52 moved + 17 new = 69 lib — nothing dropped (AC-P2) |

## 1. Lock correctness (highest priority) — PASS

`submodules/obsidian-id-lib/src/CrossPluginPathLock.ts` read line-by-line against the brief/D3 spec:

- Versioned key `__obsidian_id_lib_path_lock_registry_v1__`, plain `Map<string, Promise<unknown>>` on injectable `registryHost` (default `globalThis`) — cross-version contract kept (stored value is a plain never-rejecting Promise).
- Acquire chains off tail with `predecessor.then(NOOP, NOOP).then(task)` — predecessor rejection swallowed; a foreign rejecting tail cannot wedge the chain (AC-L7b test proves it).
- Stored tail `run.then(NOOP, NOOP)` never rejects — foreign non-swallowing waiters protected (AC-L4).
- Cleanup: `void next.then(() => { if (registry.get(path) === next) registry.delete(path); })` — only the CURRENT tail deletes; verified the successor-detach race manually and via AC-L5b. The settle→cleanup microtask gap is safe: a new caller chaining off a settled-but-not-yet-cleaned tail runs immediately and installs a new tail, so the guard correctly skips deletion.
- No expiry/timeout; release implicit on settle (finally semantics). FIFO holds — `runExclusive` is synchronous through `registry.set`, so single-threaded JS admits no interleaving in the get→set window.
- Caller observes `run` (the task's own result/rejection) — rejection surfaces (AC-L3).
- Lock scope: `DocIdServiceDefault.ensureDocId` wraps only `store.ensureId(file)` under `runExclusive(file.path, …)`; dispatch/null-check outside the lock; `getDocId`/`isEligible` lock-free and never write — proven by AC-S2 (host stays key-free) and AC-S3 tests.
- Re-entrancy: no nested same-path acquisition exists in the lib (store code never calls back into the service), so the non-reentrant chain cannot self-deadlock.
- The two `as` casts (`registryHost as Record<string, unknown>`, `existing as LockRegistry`) are genuine system-boundary casts (untyped shared global), each with a WHY comment — house-rule compliant.
- Test suite covers AC-L1..L7 including the two-instances-one-host rendezvous (two bundled copies) and foreign pending/rejecting pre-seeded tails.

## 2. Behavior preservation — PASS

Diffed every moved file against the pre-move originals (`git show 9a24c64^:src/core/service/docId/…`):

- `DocIdStore.ts` byte-identical. `DocIdGenerator.ts` differs only by an AP `ref.` doc line + a stale-name doc fix (`ensureDocId` → `ensureId`). Stores differ ONLY by the `NoteFileUtil` → `FileContentAccess` seam rename and `[VHP]` → `[obsidian-id-lib]` log prefix — every WHY/WHY-NOT comment preserved (incl. the processFrontMatter WHY-NOT and excalidraw owner decision).
- Test-title diff (comm of `it('…')` sets per file): **ZERO removed**, only additions (2 AC-B7 re-check backstop tests, 3 lock-delegation tests). All variable renames (`noteFileUtil` → `fileAccess`) are substance-neutral.
- All CLAUDE.md doc-id invariants re-verified as still tested: existing id of ANY format honored + file untouched; occupied-unusable slot (nested mapping) never overwritten; raw `.excalidraw` → null; empty/whitespace canvas = `{}` new canvas; CRLF preserved; only the id line added/filled; malformed canvas → `console.error` + null.
- The AC-B7 canvas test honestly asserts content-preservation only, because `CanvasDocIdStore.ensureId` returns the generated id even when the re-check kept a concurrent one — a PRE-EXISTING asymmetry vs the frontmatter store, correctly preserved per mandate and transparently disclosed (see MINOR-1).

## 3. Packaging soundness — PASS

- Lib tsconfig mirrors plugin strictness exactly (strict, ES2021, node resolution, isolatedModules, noUncheckedIndexedAccess, noImplicitReturns; drops only jsx/sourcemap — no React in lib). `file:` dep resolves via npm symlink (verified in package-lock: `node_modules/obsidian-id-lib` → `submodules/obsidian-id-lib`).
- Lib is self-testable: own vitest config with `obsidian` → trimmed `obsidianMock.ts` alias; plugin's vitest transformed the symlinked lib fine (no `server.deps.inline` needed — plugin vitest.config/esbuild.config confirmed UNCHANGED).
- `obsidian` is peer + dev in the lib, types-only, never bundled. `eslint.config.mts` ignores `submodules` (with WHY comment). `index.ts` barrel uses `export type` for type-only exports (isolatedModules-safe).
- `DocIdBackfillService.integration.test.ts` imports REAL lib classes through the `'obsidian-id-lib'` package boundary with `FakeNoteFileUtil` passing structurally as `FileContentAccess` — genuine consumer-side seam proof (AC-P3).

## 4. README + docs — PASS

- Lib README: concise, covers usage (one-liner + DI form), id-format contract (AP `ap_iZAE3fAcs5zXIWrTiIdx3_E`), window-key contract + full protocol (AP `ap_e7fWGWziwxrLmnegjIYKX_E`), guarantees, consumption, dev, ESLint follow-up. Accurate against the code.
- `docs/migration/extraction-of-id.md`: STATUS IMPLEMENTED; §Solution.3 now documents raw-text `Vault.process` + in-transform re-check with the WHY-NOT-processFrontMatter rationale (Q1 honored); §2 documents the docid format + existing-ids-honored (Q2); API surface matches reality (Q3); final key + Map shape recorded; AP refs present.
- `AGENTS.md`/CLAUDE.md (symlink verified), `docs/architecture.md`, plugin `README.md` (`--recurse-submodules`): all checked against the diff — accurate, succinct, no stale claims. `DocIdFilenameSafety.ts` gained the format-contract `ref.` AP.

## 5. Git hygiene — PASS

- Submodule `main`: `a867be8` (scaffold) → `c94e016` (move + lock) → `85d9ed5` (README) — coherent milestones; working tree clean; only intended files tracked (`.gitignore`: node_modules/, .tmp/; lib package-lock committed deliberately).
- Parent: `9a24c64` (consume lib + drop ulid, includes submodule pointer bump — commit stays buildable), `2726a18` (docs, pointer → `85d9ed5`), `c34aa58` (.ai_out artifacts only). Parent pointer = `85d9ed5` = final submodule SHA. Nothing forbidden committed (no main.js, no node_modules).
- **HANDOFF CAVEAT stands (human action)**: submodule `main` @ `85d9ed5` must be pushed to `git@github.com:nickolay-kondratyev/obsidian-id-lib.git` before/when the parent branch is shared, or the parent references an unreachable SHA.

## 🚨 BLOCKING Issues

None.

## ⚠️ MAJOR Issues

None.

## 💡 MINOR Issues

1. **Canvas `ensureId` return-value asymmetry** (`submodules/obsidian-id-lib/src/CanvasDocIdStore.ts:31-47`): when the in-transform re-check keeps a concurrently-written id, the method still returns the (unwritten) generated id, while `FrontmatterDocIdStore` returns the concurrent id. Pre-existing behavior, correctly preserved per mandate and disclosed. Why it matters: a consumer using the returned id (e.g. as a history filename) could key data under an id the file doesn't hold — reachable only when the lock is bypassed (third non-lib plugin). Suggested fix (follow-up, needs owner sign-off as a behavior change): have the canvas transform capture and return the re-checked id like the frontmatter store does.
2. **Follow-up candidates not materialized as tickets**: the report lists 4 follow-ups (lib ESLint; canvas nuance above; dev-container npm/nvm env; retry-on-modify adjacency) but no files were added under `docs/tickets/`. House rule is to create follow-up tickets for issues spotted outside scope. Suggested fix: add two one-paragraph tickets (lib-eslint, canvas-ensureId-return) in `docs/tickets/` — or the lib repo's tracker once pushed.
3. **AC-P6 (fresh standalone lib install) verified only partially**: lib `check`+`test` ran green standalone, but not from a from-scratch `npm install` in a clean clone. Low risk (lockfile committed); worth one manual run after the submodule is pushed.

## NITS (optional)

- `CLARIFICATION` Q3 literally said "thin `app`-taking facade"; the shipped facade takes `Vault` (`DocIdServices.createDefault(app.vault)`). Deliberate narrowing, flagged in the approved plan (D2) — no action unless the human prefers the literal `App` signature.
- Plugin tsconfig `include: ["src/**/*.ts"]` doesn't cover `.tsx` — pre-existing, unrelated to this change.

## Documentation Updates Needed

None — all required docs were updated and verified accurate.
