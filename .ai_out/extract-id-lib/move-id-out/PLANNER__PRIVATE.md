# PLANNER PRIVATE MEMORY — extract-id-lib / move-id-out

Rehydration notes for a future PLANNER clone. Public plan: DETAILED_PLANNING__PUBLIC.md (same dir). Written 2026-07-16 after reading EXPLORATION__PUBLIC, CLARIFICATION__PUBLIC, design brief, and the actual sources.

## What I verified directly (don't re-read unless suspicious)
- `src/core/service/docId/`: 5 source files + 6 test files (backfill has unit + integration). Stores depend ONLY on `NoteFileUtil.cachedRead` + `.process` and `DocIdGenerator`. `DocIdServiceDefault` ctor = (fmStore, canvasStore), Map by extension.
- `NoteFileUtil` (src/core/util/file/note/NoteFileUtil.ts) has 4 methods; the 2-method subset is exactly `cachedRead(file)` + `process(file, transform)` — so `NoteFileUtil` and `FakeNoteFileUtil` STRUCTURALLY satisfy the planned lib `FileContentAccess`. This is load-bearing for keeping the plugin's integration test cheap.
- `FakeNoteFileUtil` has `processCallCount` / `cachedReadCallCount` counters — reused these in acceptance criteria (AC-S1 single-write assertion). The lib's `FakeFileContentAccess` should keep those counters.
- Consumers needing import retarget (grepped): DocIdFocusListener(.ts + .test), VhV3FocusDurationListener, VisitHistoryServiceV3 (`service/docId/DocIdService` via exploration; grep hit through listener paths), PluginFactory (5 imports), testSupport/fakes.ts, DocIdBackfillService(.ts + tests). settingsTab imports only DocIdBackfillService (stays — path unchanged).
- eslint.config.mts uses `globalIgnores([...])` — add `'submodules'` there.
- vitest.config.ts: alias obsidian→testSupport/obsidianMock.ts; include `src/**/*.test.ts(x)` → lib tests won't run in plugin; decided lib runs own vitest.
- CanvasDocIdStore.test.ts: grep for console.error assertions returned nothing → log-prefix change `[VHP]`→`[obsidian-id-lib]` is test-safe (it imports `vi` likely to silence console).
- Submodule state: checked out `main` @ 7ece9a3 "Initial commit", clean, README.md only, remote origin = git@github.com:nickolay-kondratyev/obsidian-id-lib.git. Submodule README mentions canvases (consistent with Q4=canvas moves).
- docs/architecture.md has a "Doc id flow" section (~lines 126-165) + diagram lines 19-47 mentioning DocIdService/Backfill — the doc-update surface I sized Phase 4.4 on.
- ulid: in package.json dependencies, zero hits in src (per exploration).

## Key reasoning / why I decided what I decided
- **Packaging = npm file: dep with raw TS (main+types → src/index.ts)**. Chain of reasoning:
  - esbuild resolves `main` to .ts and compiles it (built-in ts loader) → bundles fine.
  - tsc moduleResolution:node resolves types/main pointing at .ts (standard internal-package pattern); lib sources get type-checked under the PLUGIN's strict options too — so lib tsconfig must mirror strictness (isolatedModules ⇒ `export type` in barrel — I flagged this).
  - vite/vitest: symlinked deps resolve to realpath OUTSIDE node_modules ⇒ inlined/transformed ⇒ the `obsidian` alias applies to lib files. Fallback documented: `test.server.deps.inline: [/obsidian-id-lib/]`. I did NOT test this empirically — if implementation hits externalization, use the fallback, don't change consumption model.
  - npm 7+ auto-installs peerDeps; lib peerDep `obsidian: "*"` is already satisfied by plugin devDep. Lib has zero runtime deps (global `crypto`).
- **Lock placement**: in `DocIdServiceDefault.ensureDocId`, REQUIRED ctor param `pathLock: PathLock` (3rd arg). Rejected decorator (consumer could wire unlocked service; CLARIFICATION says lock is THE critical requirement) and store-level (duplicated in 2 stores). Dispatch/null-store check stays OUTSIDE the lock so unsupported extensions never touch the registry (AC-S3).
- **Lock algorithm subtlety** (worked through carefully, matches brief §Solution.1):
  - `run = predecessor.then(NOOP, NOOP).then(task)` — swallow FOREIGN predecessor rejection.
  - stored tail `next = run.then(NOOP, NOOP)` — NEVER rejects (protects foreign copies that don't swallow; also avoids unhandledrejection noise). "finally-release" from the brief is realized by `next` settling either way; caller still sees task's own rejection via `run`.
  - cleanup: `next.then(() => { if (registry.get(path) === next) registry.delete(path) })` — the `=== next` tail guard.
  - Registry host = `globalThis` default (=== window in renderer; works in node vitest), ctor param `registryHost: object = {}`-able for test isolation AND two-copy simulation (two lock instances, one host). Key: `__obsidian_id_lib_path_lock_registry_v1__`, value `Map<string, Promise<unknown>>`. I CHOSE this key name (brief's `__note-id-lock-registry-v1__` was "e.g."); documented as public contract + AP. If human wants a different name it's a 1-line change — didn't escalate.
- **InFlightDropGuard stays** in DocIdFocusListener (DROP before lock QUEUE; compatible, no nesting ⇒ no deadlock). FocusTracker chain + backfill JOIN untouched.
- **Names kept identical** (DocIdService etc.) to minimize plugin diff; only imports change. Log prefix changes to `[obsidian-id-lib]`.
- **Lib ESLint skipped in v1** (PARETO): plugin's `eslint .` ignores `submodules`; lib gets tsc+vitest; follow-up ticket noted in lib README outline. Zero-lint rule is a plugin-repo rule.
- **DocIdBackfillService.integration.test.ts stays plugin-side** and becomes the consumer-side seam test — constructs real lib classes with FakeNoteFileUtil (structural fit) + `new CrossPluginPathLock({})`.
- **Git**: submodule commits first (scaffold / move+lock / README), parent commit bundles pointer + package.json + rewiring so every parent commit builds. Push-order hazard (parent referencing unpushed submodule SHA) → Phase 5 handoff note; do NOT push parent unprompted.

## Dead-ends / rejected explicitly (don't relitigate)
- `processFrontMatter` — overridden by CLARIFICATION Q1 (raw Vault.process stays; brief gets updated).
- uuid/nanoid — Q2: keep `docid_{24 base36}_e`.
- Free-function API `getId(app, file)` — Q3: DI classes + static `DocIdServices.createDefault(vault)` facade (house rule: no free functions; Vault not App = narrowest handle).
- tsconfig paths / relative imports consumption — rejected (config duplication / boundary erasure).
- Lib own build step (d.ts+js) — rejected (stale artifacts, no benefit).
- Running lib tests inside plugin's vitest by widening include — rejected: lib must be green STANDALONE ("dev env is battle station" in both repos); plugin keeps seam coverage via the integration test instead.

## Open threads for whoever comes next
- Window key name is MY choice — surface it to the human in review (it's the cross-plugin contract; the OTHER plugin must adopt the same lib anyway, so low risk).
- Anchor points: repo has zero today; plan says create 2 in lib README (window contract, id format) via `anchor_point_create` if the shell function exists, else mint `ap_<random>_E` manually. Low stakes.
- Possible empirical failure points for IMPLEMENTATION: (1) vitest externalization (fallback ready), (2) tsc editor resolution of .ts main (fallback: tsconfig paths hint), (3) npm file: + package-lock churn. None plan-breaking.
- docs/tickets/retry-doc-id-on-modify.md — adjacent ticket; extraction must not close/expand it; lib API (ensureDocId per file) doesn't preclude it. Nothing to do now.
- Baseline counts (Phase 0) intentionally left for IMPLEMENTATION to record.
