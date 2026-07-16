# DETAILED PLAN — Extract doc-id generation into `submodules/obsidian-id-lib`

Feature: extract-id-lib | Branch: `move-id-out` | Planner output, 2026-07-16
Inputs honored: `EXPLORATION__PUBLIC.md`, `CLARIFICATION__PUBLIC.md` (binding Q1–Q4 + ulid removal), `docs/migration/extraction-of-id.md` (§Solution.1 lock spec is binding; its `processFrontMatter` and uuid/nanoid points are OVERRIDDEN by CLARIFICATION).

---

## 1. Problem understanding

Move the doc-id machinery (generator, md-frontmatter store, canvas store, dispatch service) from `src/core/service/docId/` into the greenfield git-submodule library `submodules/obsidian-id-lib` (own repo, remote `git@github.com:nickolay-kondratyev/obsidian-id-lib.git`), so a second plugin can bundle the same code. Add the NEW cross-plugin per-path async lock on a versioned `window` global (brief §Solution.1) guarding `ensureId`. The plugin then consumes the library; behavior must be byte-for-byte preserved (all "Key design decisions" doc-id bullets in CLAUDE.md). Also: remove the unused `ulid` dependency; update docs.

**Constraints that shape everything:**
- `obsidian` npm package is types-only; the lib is bundled by each consumer's esbuild into its own `main.js` → two copies at runtime → shared state ONLY via `window`.
- Plugin repo rules: strict TS, vitest with `obsidian` aliased to a mock, ESLint at zero errors, DI classes behind interfaces, no free-floating functions.
- Tests for moved code MOVE with it (never deleted); the plugin keeps meaningful coverage of the seam.

---

## 2. Decisions (with rationale and rejected alternatives)

### D1. Packaging/consumption: npm `file:` dependency, lib ships RAW TS, no build step  **[RECOMMENDED]**

Plugin `package.json`:
```json
"dependencies": { "obsidian-id-lib": "file:submodules/obsidian-id-lib" }
```
Lib `package.json`: `"name": "obsidian-id-lib"`, `"private": true`, `"main": "src/index.ts"`, `"types": "src/index.ts"`, no runtime dependencies (generator uses global `crypto`), `"peerDependencies": { "obsidian": "*" }`, devDeps only `typescript`, `vitest`, `obsidian`.

Why this works with every tool in play:
- **npm** symlinks `node_modules/obsidian-id-lib -> ../submodules/obsidian-id-lib`; a `file:` dep with zero runtime deps needs no nested install.
- **esbuild** resolves `main` → `src/index.ts` and compiles TS natively; lib code lands in `main.js` exactly as today.
- **tsc** (`moduleResolution: node`): `types`/`main` pointing at a `.ts` file pulls lib sources into the program → full strict type-checking of lib code under the plugin's compiler options (a feature, not a bug).
- **vitest/vite** resolves the symlink to its REAL path (outside `node_modules`) → lib files are transformed as source, so the `obsidian → obsidianMock.ts` alias applies to lib imports too. (Fallback if externalization ever bites: `test.server.deps.inline: [/obsidian-id-lib/]` in `vitest.config.ts`.)
- A future second plugin consumes it identically (`git submodule add` + `file:` dep).

Rejected alternatives:
- **tsconfig `paths` + esbuild alias**: duplicated config in every consumer, no cleaner import than `file:` gives; more moving parts.
- **Direct relative imports** (`../../submodules/obsidian-id-lib/src/...`): zero config but couples every import site to submodule layout and erases the library boundary — the opposite of the extraction's point.
- **Lib with its own build (d.ts + js artifacts)**: adds a build orchestration step and stale-artifact hazards for zero benefit — consumers bundle from source anyway.

**Where tests run:** the lib runs its OWN vitest (own `vitest.config.ts` + own tiny `obsidian` mock) — "tests must always run" holds standalone in the lib repo. The plugin's vitest keeps running its own tests, including a retained integration test that imports REAL lib code through `obsidian-id-lib` (cross-boundary coverage in the consumer). ESLint: add `submodules` to the plugin's `globalIgnores` (the plugin's `eslint .` must not lint foreign-repo code). The lib gets `tsc --noEmit` + vitest in v1; its own ESLint is a follow-up ticket noted in the lib README (PARETO — the code arrives already lint-clean from this repo).

### D2. Library API: same DI classes/interfaces, lib-owned 2-method file-IO seam, tiny static factory

Keep the existing names (minimal churn, they are already generic): `DocIdService`/`DocIdServiceDefault`, `DocIdStore` + `ExistingIdState` + `DocIdValues`, `DocIdGenerator`/`DocIdGeneratorDefault` + `DOC_ID_PREFIX/SUFFIX/RANDOM_LENGTH`, `FrontmatterDocIdStore`, `CanvasDocIdStore`.

New lib-owned pieces:
- **`FileContentAccess`** (replaces the plugin's 4-method `NoteFileUtil` at the lib boundary — only the 2 methods docId code uses):
  ```ts
  export interface FileContentAccess {
    cachedRead(file: TFile): Promise<string>;
    process(file: TFile, transform: (content: string) => string): Promise<void>;
  }
  ```
  Default impl `VaultFileContentAccess` takes `Vault` (narrowest Obsidian handle; `App` rejected — too wide) and delegates to `vault.cachedRead`/`vault.process`. Note: the plugin's `NoteFileUtil`/`FakeNoteFileUtil` STRUCTURALLY satisfy this interface (same two signatures) — plugin-side tests can pass them directly.
- **`PathLock`** interface + **`CrossPluginPathLock`** (see D3).
- **Facade/factory** (Q3's "thin app-taking facade", as a static class per house rules — no free functions):
  ```ts
  export class DocIdServices {
    /** Wires generator + both stores + cross-plugin lock. One-line adoption. */
    static createDefault(vault: Vault): DocIdService;
  }
  ```
- **`src/index.ts` barrel** exporting all of the above (use `export type` for type-only exports — the consumer compiles with `isolatedModules`).

The lib's ONLY `obsidian` imports stay `TFile` (type) + `Vault` (type, in `VaultFileContentAccess`/factory). Log prefix in moved code changes `[VHP]` → `[obsidian-id-lib]` (behavior-neutral; adjust any test that asserts it).

### D3. Cross-plugin lock: inside `DocIdServiceDefault.ensureDocId`, injected as `PathLock`, registry on a versioned global key

**Placement**: the lock wraps the WHOLE per-file `store.ensureId(file)` call (read-decide-write) at the service level — one place (DRY), and every lib consumer's creation path (`ensureDocId` is the documented single entry point for creation) goes through it. `getDocId` stays lock-free and read-only (heatmap bulk path — exploration risk #9). Locking store-level was rejected (duplicated in two stores); a separate `LockedDocIdService` decorator was rejected (a consumer could wire the unlocked service by accident — the lock is the CLARIFICATION-critical piece, so `DocIdServiceDefault` REQUIRES a `PathLock` constructor arg; the factory supplies the real one, tests may supply a pass-through fake).

**Contract (public API — document in lib README, guard with an anchor point):**
- Key: `__obsidian_id_lib_path_lock_registry_v1__` on `globalThis` (=== `window` in Obsidian's renderer; using `globalThis` makes the same code work in Node-based vitest). Exported as `ID_LOCK_REGISTRY_KEY` const.
- Value shape: a plain `Map<string, Promise<unknown>>` — path → current tail promise. Plain promises only, so differently-versioned bundled copies interoperate. Bump the `_v1_` suffix ONLY as a deliberate breaking change.
- Protocol: acquire = chain off the current tail (swallowing its rejection), store your new tail, run; the stored tail promise must NEVER reject; only the CURRENT tail deletes its Map entry (`=== next` guard). No timeout/expiry.

**Algorithm (precise — this is the one snippet-worthy piece):**
```ts
export interface PathLock {
  /** Runs task exclusively per path: same path serializes (FIFO), distinct paths run in parallel. */
  runExclusive<T>(path: string, task: () => Promise<T>): Promise<T>;
}

export class CrossPluginPathLock implements PathLock {
  // registryHost: where the versioned key lives. Default globalThis (=== window
  // in Obsidian). Tests pass a fresh {} for isolation / two-copy simulation.
  constructor(registryHost: object = globalThis) { ... }

  runExclusive<T>(path: string, task: () => Promise<T>): Promise<T> {
    const registry = this.getOrCreateRegistry(); // Map on host[ID_LOCK_REGISTRY_KEY], created once
    const predecessor = registry.get(path) ?? Promise.resolve();
    // Swallow predecessor rejection: a FOREIGN lib copy may have stored a
    // rejecting promise — its failure must not wedge this waiter.
    const run = predecessor.then(NOOP, NOOP).then(task);
    // Store a tail that NEVER rejects, so foreign waiters (which may not
    // swallow) cannot be wedged by OUR task's failure.
    const next = run.then(NOOP, NOOP);
    registry.set(path, next);
    // Tail cleanup: only the CURRENT tail removes the entry — a queued
    // successor must not be detached by its predecessor's cleanup.
    void next.then(() => {
      if (registry.get(path) === next) registry.delete(path);
    });
    return run; // caller observes task's own result/rejection (release is implicit: `next` settles either way — the finally-semantics of the brief)
  }
}
```

**Interaction with existing plugin-side serialization — all stays as-is (no double-lock problem):**
- `DocIdFocusListener`'s `InFlightDropGuard` STAYS: DROP semantics cheaply suppress same-plugin focus-event storms BEFORE reaching the lock; the lock QUEUEs cross-plugin contenders. Different, compatible semantics; no deadlock possible (no nested acquisition of the same path inside a task).
- `FocusTracker` serialized dispatch, `DocIdBackfillService` JOIN: untouched. Backfill's sequential `ensureDocId` calls simply each take/release the lock.
- The in-transform re-check inside `Vault.process` (both stores) remains the idempotency BACKSTOP per CLARIFICATION non-negotiables — lock primary, re-check seatbelt.

### D4. What moves vs stays — confirmed split

| MOVES to lib (with tests) | STAYS in plugin |
|---|---|
| `DocIdService.ts` (+ `DocIdService.test.ts`) | `DocIdBackfillService.ts` (+ both tests) — VaultUtil/tracked-files coupling |
| `DocIdStore.ts` (`DocIdStore`, `ExistingIdState`, `DocIdValues`) | `DocIdFocusListener` (+ test), `VhV3FocusDurationListener` |
| `DocIdGenerator.ts` (+ test) | `DocIdFilenameSafety` (VH-filename concern; consumes the FORMAT contract only) |
| `FrontmatterDocIdStore.ts` (+ test) | `InFlightDropGuard`, `FocusTracker`, all wiring (`PluginFactory`) |
| `CanvasDocIdStore.ts` (+ test) | `FakeDocIdService` (in `fakes.ts` — retargets its import to the lib), `FakeNoteFileUtil` (still used by backfill-integration + ContentTermMatcher tests) |
| NEW: `CrossPluginPathLock`, `FileContentAccess` + `VaultFileContentAccess`, `DocIdServices` factory, `index.ts`, lib testSupport | `DocIdBackfillService.integration.test.ts` — stays and now imports lib classes via `obsidian-id-lib` = the consumer-side integration test of the seam |

### D5. Git mechanics (submodule has its OWN history)

1. All lib work = commits on the submodule's `main` (currently at `7ece9a3`, clean, remote wired). Milestone commits: scaffold → code+tests moved → README/contract.
2. Parent repo (`move-id-out`): plugin diffs + the submodule POINTER update (`git add submodules/obsidian-id-lib`) commit together with the `package.json` change that starts depending on it (keeps every parent commit buildable).
3. **Push order caveat**: the submodule's `main` must be pushed to `origin` before (or when) the parent branch is pushed/shared — otherwise the parent references an unreachable SHA. If the implementation environment lacks SSH push credentials, STOP at "committed locally" and hand the push to the human (call it out explicitly in the final report). Do NOT push the parent repo unprompted (house rule: commit/push only when asked — committing at milestones is asked; pushing is flagged).

### D6. Misc decisions
- **`ulid` removed** from plugin `package.json` dependencies (approved) + lockfile refresh + CLAUDE.md deps line.
- **Anchor points** (repo currently has none): create two in the lib README — one on the window-registry-key contract, one on the id-format contract — and reference them (`ref.` prefix) from `CrossPluginPathLock.ts`/`DocIdGenerator.ts` doc comments, the plugin's `DocIdFilenameSafety.ts` comment, and the design brief. Use `anchor_point_create` if available in the implementation shell; otherwise mint ids in the same `ap_<random>_E` format.
- **Fresh-clone story**: document `git clone --recurse-submodules` (or `git submodule update --init`) before `npm install` in both READMEs + CLAUDE.md dev-env section.

---

## 3. Target library file tree

```
submodules/obsidian-id-lib/            (own git repo, branch main)
  package.json          # name obsidian-id-lib, private, main/types → src/index.ts,
                        # scripts: test (vitest run), check (tsc -noEmit),
                        # peerDeps: obsidian; devDeps: typescript, vitest, obsidian
  tsconfig.json         # mirror plugin strictness: strict, ES2021, moduleResolution node,
                        # isolatedModules, noUncheckedIndexedAccess, noImplicitReturns,
                        # lib [ES2021, DOM]; include src/**/*.ts (no jsx)
  vitest.config.ts      # alias obsidian → src/testSupport/obsidianMock.ts; include src/**/*.test.ts
  .gitignore            # node_modules/, .tmp/
  README.md             # rewrite — see §5 "Lib README outline"
  src/
    index.ts                    # barrel (export type where type-only)
    DocIdService.ts             # interface + DocIdServiceDefault(fmStore, canvasStore, pathLock)
    DocIdService.test.ts
    DocIdStore.ts               # DocIdStore, ExistingIdState, DocIdValues (verbatim)
    DocIdGenerator.ts           # verbatim (+ AP ref on format contract)
    DocIdGenerator.test.ts
    FrontmatterDocIdStore.ts    # verbatim except FileContentAccess import
    FrontmatterDocIdStore.test.ts
    CanvasDocIdStore.ts         # verbatim except FileContentAccess import + log prefix
    CanvasDocIdStore.test.ts
    FileContentAccess.ts        # interface + VaultFileContentAccess (Vault-backed)
    CrossPluginPathLock.ts      # PathLock, CrossPluginPathLock, ID_LOCK_REGISTRY_KEY (+ AP ref)
    CrossPluginPathLock.test.ts # the lock acceptance suite (§6)
    DocIdServices.ts            # static factory createDefault(vault)
    DocIdServices.lock.test.ts  # service-level lock integration (two copies, one write)
    testSupport/
      obsidianMock.ts           # TFile/TAbstractFile subset only (copied, trimmed)
      fileFactory.ts            # makeTFile (copied)
      FakeFileContentAccess.ts  # in-memory 2-method fake (trimmed FakeNoteFileUtil:
                                # seedNote/getContent/cachedRead/process + call counters)
```

---

## 4. Implementation phases (serial, for one IMPLEMENTATION agent)

### Phase 0 — Baseline (verification harness)
1. `npm install && npm test && npm run build && npm run lint` in the plugin repo → all green; redirect verbose output to `.tmp/`. Record counts (test files/tests) to compare after the move.
- **Verify**: green baseline recorded.

### Phase 1 — Scaffold the library (submodule repo)
1. In `submodules/obsidian-id-lib`: create `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/testSupport/{obsidianMock.ts,fileFactory.ts,FakeFileContentAccess.ts}` per §3. `npm install` inside the lib.
2. Commit in the SUBMODULE: `Scaffold obsidian-id-lib: raw-TS package, strict tsconfig, vitest with obsidian mock`.
- **Verify**: `npm run check` and `npm test` run in the lib (0 tests OK at this point).

### Phase 2 — Move the code + add the lock (submodule repo)
1. Copy the five source files + four test files from `src/core/service/docId/` (exploration §1 table; NOT `DocIdBackfillService*`) into `submodules/obsidian-id-lib/src/`, adapting ONLY: `NoteFileUtil` import → `FileContentAccess`; test fakes → `FakeFileContentAccess`/lib `fileFactory`; log prefix `[VHP]` → `[obsidian-id-lib]`. Preserve every WHY/WHY-NOT comment verbatim (esp. FrontmatterDocIdStore's processFrontMatter WHY-NOT and DocIdServiceDefault's excalidraw WHY-NOT).
2. Write `FileContentAccess.ts` (interface + `VaultFileContentAccess`).
3. Write `CrossPluginPathLock.ts` exactly per D3 algorithm + `CrossPluginPathLock.test.ts` covering §6 AC-L1..L7.
4. Extend `DocIdServiceDefault`: third ctor param `pathLock: PathLock`; `ensureDocId` becomes
   `return this.pathLock.runExclusive(file.path, () => store.ensureId(file))` (dispatch/null-store check stays OUTSIDE the lock; `getDocId`/`isEligible` untouched). Update `DocIdService.test.ts` (inject a pass-through fake lock for the existing dispatch cases; add lock-delegation case AC-S3).
5. Write `DocIdServices.ts` factory + `DocIdServices.lock.test.ts` (AC-S1/S2 rendezvous + single-write tests).
6. Write `src/index.ts` barrel.
7. `npm run check && npm test` in the lib → green. Commit in the SUBMODULE: `Move doc-id generator/stores/service from visit-history plugin; add cross-plugin per-path window lock`.
- **Verify**: all moved tests pass unchanged in substance; new lock suite green.

### Phase 3 — Rewire the plugin (parent repo)
1. `package.json`: add `"obsidian-id-lib": "file:submodules/obsidian-id-lib"` to dependencies; REMOVE `"ulid"`. `npm install` (refreshes lockfile).
2. Delete moved files from `src/core/service/docId/` (keep `DocIdBackfillService.ts` + its two tests). Directory now holds backfill only.
3. Retarget imports to `'obsidian-id-lib'` in: `PluginFactory.ts` (replace generator/store/service wiring lines 59–63 with `this.docIdService = DocIdServices.createDefault(app.vault);`), `DocIdFocusListener.ts` (+ its test), `VhV3FocusDurationListener.ts`, `VisitHistoryServiceV3.ts`, `DocIdBackfillService.ts` (+ unit test), `testSupport/fakes.ts` (`FakeDocIdService`).
4. `DocIdBackfillService.integration.test.ts`: import lib classes from `'obsidian-id-lib'`; construct `new DocIdServiceDefault(new FrontmatterDocIdStore(fakeNoteFileUtil, gen), new CanvasDocIdStore(fakeNoteFileUtil, gen), new CrossPluginPathLock({}))` — `FakeNoteFileUtil` satisfies `FileContentAccess` structurally; fresh `{}` registry host isolates the test. This test is now the consumer-side integration proof (AC-P3).
5. `eslint.config.mts`: add `'submodules'` to `globalIgnores`.
6. `npm run build && npm test && npm run lint` → green (fallback if vitest externalizes the lib: `test.server.deps.inline`). Grep-verify no `service/docId/DocIdService|DocIdStore|DocIdGenerator|FrontmatterDocIdStore|CanvasDocIdStore` imports remain, and `ulid` absent from `package.json`/`package-lock.json`/`src/`.
7. Commit in the PARENT (includes submodule pointer): `Consume obsidian-id-lib (file: dep) for doc ids; add cross-plugin path lock; drop unused ulid`.
- **Verify**: AC-P1..P5 (§6).

### Phase 4 — Documentation
1. **Lib README rewrite** (submodule) per §5 outline; commit in submodule: `README: usage, window-lock contract, id format contract`.
2. **`docs/migration/extraction-of-id.md`**: mark IMPLEMENTED (pointer to lib); rewrite §Solution.3 → raw-text `Vault.process` + in-transform re-check with the WHY-NOT-processFrontMatter rationale (Q1); §Solution.2 → `docid_{24 base36 lowercase}_e`, existing ids honored (Q2); §API surface → DI classes + `DocIdServices.createDefault` facade (Q3); record the final window key + Map value shape.
3. **`CLAUDE.md`**: architecture tree — `service/docId/` entry now = `DocIdBackfillService` + pointer "generator/stores/service/lock live in `submodules/obsidian-id-lib` (git submodule, bundled via `file:` dep)"; "Key design decisions" doc-ids bullet — add the cross-plugin lock + versioned window key + lib extraction; deps line — remove `ulid`, add `obsidian-id-lib` submodule; dev-env — `git submodule update --init` before `npm install`. Keep entries SUCCINCT.
4. **`docs/architecture.md`**: "Doc id flow" section + component-diagram lines — insert the lib boundary and the lock step (`DocIdService (obsidian-id-lib) — per-path cross-plugin window lock → store`). Skim `docs/README.md` for staleness (likely no change).
5. Commit in the PARENT: `Docs: doc-id library extraction + cross-plugin lock (CLAUDE.md, architecture, design brief)`.

### Phase 5 — Final verification & handoff
1. Full re-run: lib (`npm run check && npm test`) + plugin (`npm run build && npm test && npm run lint`).
2. Confirm `main.js` (dev build) contains the lock registry key string (proof the lib bundled in).
3. Push the SUBMODULE `main` to origin if credentials permit; otherwise report "submodule committed locally at <sha>, push required before sharing the parent branch". Do not push the parent.

---

## 5. Lib README outline (concise, well-formed)

1. **What**: shared doc-id read/ensure for Obsidian plugins (md frontmatter `id`, canvas `metadata.frontmatter.id`) with cross-plugin write serialization. One paragraph.
2. **Usage**: `DocIdServices.createDefault(app.vault)` one-liner + the DI form (stores/generator/lock) for custom wiring; `ensureDocId` vs read-only `getDocId` vs `isEligible`.
3. **Id format contract** (AP here): `docid_{24 base36 lowercase}_e`; existing ids of ANY format honored as-is, never rewritten; unusable occupied slot never overwritten; ids should remain filename-safe for consumers that use them as filenames.
4. **Window-key compatibility contract** (AP here): key name `__obsidian_id_lib_path_lock_registry_v1__` on `window`/`globalThis`; value `Map<string, Promise<unknown>>` of path → tail; protocol rules (chain, never-rejecting stored tail, swallow predecessor rejection, `=== next` cleanup, no expiry); bump key version only as deliberate break.
5. **Consumption**: git submodule + `"obsidian-id-lib": "file:..."`; raw TS bundled by the consumer's esbuild; `obsidian` is types-only/peer.
6. **Guarantees**: idempotency backstop inside atomic `Vault.process` transform; raw-text edits touch only the id line (WHY-NOT `processFrontMatter`); malformed content never throws; read paths never write.
7. **Dev**: `npm install && npm test && npm run check`. Follow-up: add ESLint.

---

## 6. Acceptance criteria (automated tests)

### Lock unit suite — `CrossPluginPathLock.test.ts` (fresh `{}` host per test)
- **AC-L1 same-path serialization**: two `runExclusive('a', …)` with deferred tasks → second task does not START until first RESOLVES (order log assertion).
- **AC-L2 distinct-path parallelism**: task on `'a'` blocked → task on `'b'` runs to completion.
- **AC-L3 release-on-throw**: first task rejects → its caller sees the rejection AND a queued second task on the same path still runs.
- **AC-L4 stored tail never rejects**: seed a throwing task; capture `registry.get(path)` before settle; assert it RESOLVES (protects foreign-version waiters).
- **AC-L5 tail-cleanup guard**: (a) after sole task settles, the Map entry for the path is deleted; (b) with a queued successor, the predecessor's completion does NOT delete the entry (entry still present and `=== successor tail` until it settles).
- **AC-L6 foreign-copy rendezvous**: TWO `CrossPluginPathLock` instances sharing one host object → same-path serialization holds across instances (simulates two bundled lib copies on one `window`).
- **AC-L7 foreign-version tolerance**: manually pre-seed the registry with a plain pending/rejecting `Promise` (simulating an older lib version's tail) → `runExclusive` waits for it / is not wedged by its rejection.

### Service/lock integration — `DocIdServices.lock.test.ts` + `DocIdService.test.ts`
- **AC-S1 one write under race**: two `DocIdServiceDefault` instances (two "plugins") sharing one registry host and one `FakeFileContentAccess` over the same id-less file → both `ensureDocId` calls return the SAME id and `processCallCount === 1` (second locked-out writer's fast-path/re-check sees the id and bails — idempotency backstop observable).
- **AC-S2 getDocId lock-free**: `getDocId` never creates a registry entry (host stays key-free) and never calls `process`.
- **AC-S3 lock delegation**: `ensureDocId` invokes `PathLock.runExclusive` with `file.path`; unsupported extensions return `null` WITHOUT touching the lock.

### Preserved-behavior suite (moved tests, must pass unchanged in substance)
- **AC-B1..B7**: existing id of any format honored, file untouched (no `process` call); occupied unusable `id:` nested-mapping slot never overwritten (`null`); raw `.excalidraw` → `null`; empty canvas → `{}` + id on ensure; malformed canvas JSON → `console.error` + `null`, no throw; frontmatter edits only add/fill the id line (quotes/formatting of other keys untouched, CRLF preserved); in-transform re-check returns the concurrent id.

### Plugin-side
- **AC-P1**: `npm run build` green; `main.js` contains `__obsidian_id_lib_path_lock_registry_v1__`.
- **AC-P2**: `npm test` green; total test count ≥ baseline minus moved-to-lib files (nothing silently dropped — moved tests all present in lib run).
- **AC-P3**: `DocIdBackfillService.integration.test.ts` passes importing lib classes from `'obsidian-id-lib'`.
- **AC-P4**: `npm run lint` zero errors with `submodules` ignored.
- **AC-P5**: `ulid` absent from `package.json`, `package-lock.json`, `src/` grep.
- **AC-P6 (lib repo standalone)**: fresh `npm install && npm run check && npm test` inside `submodules/obsidian-id-lib` is green with no reference to the parent repo.

---

## 7. Risks & mitigations
- **vitest externalization of the symlinked dep** (low): realpath outside `node_modules` should be inlined; fallback `test.server.deps.inline: [/obsidian-id-lib/]` documented in Phase 3.6.
- **tsc resolving `main/types` → `.ts`** (low): standard raw-TS internal-package pattern; if an editor/tsc quirk appears, add `"paths": { "obsidian-id-lib": ["submodules/obsidian-id-lib/src/index.ts"] }` as a secondary hint — do NOT switch consumption models for this.
- **Parent pushed before submodule** → broken checkout for others: Phase 5 handoff note is explicit.
- **`isolatedModules` in consumer**: lib barrel must use `export type` for types — called out in Phase 2.6.
- **Behavior drift during move**: files move essentially verbatim (only seam-import + log-prefix edits); moved tests are the guard.

## 8. Open questions
None blocking — all CRITICAL ambiguities were resolved in CLARIFICATION (Q1–Q4). Decided here without escalation (documented above): window key name/shape (D3 — versioned, documented as public contract), `file:` packaging (D1), lock-in-service with required ctor param (D3), lib skips ESLint in v1 (D1, follow-up ticket in lib README), push-order handoff (D5).
