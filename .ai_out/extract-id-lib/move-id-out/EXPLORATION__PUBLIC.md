# EXPLORATION — Extract doc-id generation into `submodules/obsidian-id-lib`

Branch: `move-id-out`. Design brief: `docs/migration/extraction-of-id.md` (added in c863da5 together with the submodule).
All paths below are relative to repo root `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/`.

---

## 1. Inventory of doc-id code (`src/core/service/docId/`)

| File | LOC | Role | Test |
|---|---|---|---|
| `DocIdService.ts` | 64 | `DocIdService` interface (`ensureDocId`, `getDocId` READ-ONLY, `isEligible`) + `DocIdServiceDefault`: dispatch by `file.extension` via `Map<ext, DocIdStore>` — `md` → frontmatter store (covers `.excalidraw.md`), `canvas` → canvas store; raw `.excalidraw` deliberately unsupported (owner decision, lines 39-42) | `DocIdService.test.ts` (133) |
| `DocIdStore.ts` | 45 | `DocIdStore` interface (`ensureId`/`getId` per format) + `ExistingIdState` union (`absent` vs `present`; `present` with `id: null` = occupied-unusable slot, never overwrite) + `DocIdValues.read()` classifier | (covered via store tests) |
| `DocIdGenerator.ts` | 44 | Format constants `DOC_ID_PREFIX='docid_'`, `DOC_ID_SUFFIX='_e'`, `DOC_ID_RANDOM_LENGTH=24`; `DocIdGeneratorDefault` — base36 lowercase via `crypto.getRandomValues` with rejection sampling (bytes ≥ 252 rejected to avoid modulo bias, lines 16-19). 36^24 > 2^122 (above UUID v4) | `DocIdGenerator.test.ts` (25) |
| `FrontmatterDocIdStore.ts` | 149 | md-family store. Fast path: regex-parse raw `cachedRead` content (frontmatter block + top-level `id` key incl. quoted keys, valueless `id:`, nested-mapping detection, minimal YAML scalar parsing with quote/comment handling, CRLF-aware). Write: `NoteFileUtil.process` (Obsidian `Vault.process`) with **re-check inside the atomic transform** (lines 83-87) — the existing idempotency backstop. **WHY-NOT `FileManager.processFrontMatter`: lines 30-35** — it re-serializes the whole frontmatter block, mangling formatting of keys the plugin does not own (e.g. strips quotes). Only the id line is ever added/filled | `FrontmatterDocIdStore.test.ts` (253) |
| `CanvasDocIdStore.ts` | 105 | `.canvas` store: id at `metadata.frontmatter.id` in canvas JSON; creates intermediate objects; tab indentation on write (matches Obsidian, line 8); empty/whitespace content = new canvas `{}` (lines 62-67); malformed JSON → `console.error` + `null`, never throws. Same in-transform re-check (lines 38-43) | `CanvasDocIdStore.test.ts` (224) |
| `DocIdBackfillService.ts` | 75 | Vault-wide backfill: `VaultUtil.getTrackedFiles()` → filter `isEligible` → sequential `ensureDocId` (gentle vault I/O, line 56-57); concurrent calls **JOIN** the in-flight promise (deliberately NOT `InFlightDropGuard` — needs result, lines 31-34); per-file failures collected, never abort | `DocIdBackfillService.test.ts` (124) + `DocIdBackfillService.integration.test.ts` (149, real graph faked only at `NoteFileUtil`/`VaultUtil`) |

Related but OUTSIDE the directory:

- `src/core/service/visitHistoryService/DocIdFilenameSafety.ts` (22) — static validator; ids become VH filenames (`<id>.vh_v3`), and EXISTING ids of any format are honored, so they must be filename-safe (conservative charset, ≤200 chars). Consumer of the id FORMAT contract, not of the code.
- `src/core/focusTracker/listener/DocIdFocusListener.ts` (29) — on focus, `ensureDocId` wrapped in per-path `InFlightDropGuard`; registered FIRST in `PluginFactory`.
- `src/testSupport/fakes.ts:31` — `FakeDocIdService` (path-keyed; used by listener/V3 tests). `src/testSupport/FakeNoteFileUtil.ts` (71) — in-memory vault fake used by all store tests.

## 2. Dependency graph

### Outbound (what docId code depends on)

- **`NoteFileUtil`** (`src/core/util/file/note/NoteFileUtil.ts`) — both stores use only 2 of its 4 methods: `cachedRead(file)` and `process(file, transform)`. Impl `NoteFileUtilDefault` (`.../impl/NoteFileUtilDefault.ts`) delegates to `app.vault.cachedRead` / `app.vault.process`. → Library needs only a **2-method file-IO seam** (or takes `App`/`Vault` directly per the brief's API).
- **`VaultUtil`** — `DocIdBackfillService` only. Plugin-specific (tracked-file walking, `IsTrackedProvider`, last-visit metadata) → **stays in plugin**.
- **`obsidian`**: `TFile` type import only (uses `.extension`, `.path`). No runtime obsidian API called directly from docId files.
- **`console.error`** only for failures (obsidianmd rule). No `UserNotifier` dependency anywhere in docId code (UserNotifier lives in the settings tab / notifications layer).
- **No `ulid`**: the `ulid` package is declared in `package.json` dependencies but is **unused in `src/`** (grep: zero hits). Generation is hand-rolled `crypto.getRandomValues`. Cleanup/follow-up ticket candidate.
- **No Node builtins** in docId code — good, since esbuild marks all `builtinModules` external and mobile has no Node `fs`.

### Inbound (who depends on docId code)

| Consumer | What it uses | Where |
|---|---|---|
| `DocIdFocusListener` | `DocIdService.ensureDocId` | `src/core/focusTracker/listener/DocIdFocusListener.ts:22` |
| `VhV3FocusDurationListener` | `ensureDocId` (cheap cached re-read; id already persisted by the first listener) + `DocIdFilenameSafety` | `.../VhV3FocusDurationListener.ts:28,53` |
| `VisitHistoryServiceV3` (heatmap last-visit) | `getDocId` — READ-ONLY, bulk path, must never write | `src/core/service/visitHistoryService/v3/VisitHistoryServiceV3.ts:23` |
| `PluginFactory` (wiring) | constructs generator + both stores + service (lines 59-63), registers listener FIRST (83), backfill service (94) | `src/core/init/PluginFactory.ts` |
| `VisitHistorySettingTab` | `DocIdBackfillService` + `DocIdBackfillResult` (behind ConfirmModal) | `src/settingsTab/VisitHistorySettingTab.ts:4,81` |
| `main.ts` | passes `factory.docIdBackfillService` to the settings tab | `src/main.ts:44` |
| Tests | `FakeDocIdService`, `FakeNoteFileUtil`, `makeTFile` | `src/testSupport/` |

### Move vs. stay (proposed split — to be confirmed in PLANNING)

- **MOVE to library**: `DocIdGenerator`, `DocIdStore` (+ `DocIdValues`/`ExistingIdState`), `FrontmatterDocIdStore`, `CanvasDocIdStore` (see Q4), `DocIdService` dispatch, their tests, plus the NEW window-global per-path lock. The minimal file-IO seam (`cachedRead`+`process`) either moves as a tiny lib-owned interface or is replaced by direct `App`/`Vault` usage (see Q3).
- **STAY in plugin**: `DocIdBackfillService` (VaultUtil/tracked-files coupling), `DocIdFocusListener`, `InFlightDropGuard`, `DocIdFilenameSafety` (VH-filename concern), `FocusTracker`, all wiring. `FakeNoteFileUtil`/`FakeDocIdService` — whichever side their tests land on needs them (likely duplicated or the fake moves with the store tests).

## 3. Obsidian API usage

Direct in docId files: **only the `TFile` type**. Transitively via `NoteFileUtilDefault`:

- `app.vault.cachedRead(file)` — fast-path reads (both stores).
- `app.vault.process(file, transform)` — atomic read-modify-write (both stores). This is the write primitive; the transform re-checks for an existing id, giving idempotency under concurrency within the same Vault instance.
- (`normalizePath`, `vault.create`, `getAbstractFileByPath`, `createFolder` are used by `NoteFileUtilDefault`'s OTHER methods — not by docId code.)

**Deliberately NOT used: `app.fileManager.processFrontMatter`** — see `FrontmatterDocIdStore.ts:30-35` WHY comment (whole-block re-serialization mangles formatting of keys the plugin doesn't own, e.g. strips quotes). The design brief (`docs/migration/extraction-of-id.md` §"Idempotency backstop") instead mandates that "All frontmatter writes go through `app.fileManager.processFrontMatter`". **This is a direct contradiction with a committed owner decision** — flagged as Q1 below. Note the brief's actual GOAL (second-writer-sees-id-and-bails backstop) is already achieved by the in-transform re-check inside `Vault.process`, and `Vault.process` writes are serialized per-file by Obsidian's Vault regardless of which plugin calls it — so the backstop does not strictly require `processFrontMatter`. But it only holds if the OTHER plugin also re-checks inside its own write callback.

The `obsidian` npm package is **types-only** (no runtime JS); it's a devDependency (`"latest"`). The library must depend on it the same way (dev/peer, types only) and must never be bundled — esbuild marks it `external`.

## 4. Build / packaging reality

- **esbuild** (`esbuild.config.mjs`): single entry `src/main.ts`, `bundle: true`, `format: 'cjs'`, target es2021, output `main.js`; externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, all Node `builtinModules`. Anything the library imports gets bundled into each plugin's `main.js` — matching the brief's "each plugin gets its own copy" premise (hence the `window` rendezvous).
- **tsconfig.json**: strict, ES2021, `moduleResolution: "node"`, `isolatedModules`, `noUncheckedIndexedAccess`, **`include: ["src/**/*.ts"]`** — a direct relative import of `../../submodules/obsidian-id-lib/src/...` compiles (tsc follows imports outside `include`) but consider explicit include/paths for editor + lint coverage. ESLint (`eslint-plugin-obsidianmd`) currently lints the whole repo (`eslint .`) — submodule code would be linted too unless ignored, and the submodule has no eslint config of its own.
- **vitest** (`vitest.config.ts`): aliases `obsidian` → `src/testSupport/obsidianMock.ts` (minimal runtime stand-in: `TFile`/`TAbstractFile`/`TFolder`/`normalizePath`/`Notice`); `test.include: ['src/**/*.test.ts(x)']` — **submodule tests would NOT run** under the plugin's runner without widening `include` (and the mock alias would have to serve them too), or the library runs its own vitest with its own mock.
- **Consumption options** for the submodule source (decision for PLANNING):
  1. npm `file:submodules/obsidian-id-lib` dependency (npm symlinks directories; esbuild/vitest resolve through it; lib needs its own `package.json` + entry).
  2. tsconfig `paths` alias + esbuild `alias`/plugin.
  3. Plain relative imports into the submodule's `src/` (zero config, but couples layout and blurs the lib boundary).
- Cross-plugin dedup is impossible (separate bundles) — the brief's versioned `window` key is the only shared-state channel. Keep the lock value a **plain Promise chain** so different bundled versions interoperate.
- Mobile-safe: docId code uses only `crypto.getRandomValues` + Vault APIs — no Node deps.

## 5. Current locking / serialization (where the window lock slots in)

| Mechanism | Scope | Semantics | Location |
|---|---|---|---|
| `FocusTracker.dispatchChain` | one plugin, all focus events | global serialization of listener dispatch (in-order focus/unfocus) | `src/core/focusTracker/FocusTracker.ts:54-60` |
| `InFlightDropGuard` (per path) | one plugin, `DocIdFocusListener` | **DROP** — concurrent same-path `ensureDocId` skipped | `src/core/util/async/InFlightDropGuard.ts`; used at `DocIdFocusListener.ts:21` |
| In-transform re-check | same Vault (all plugins using `Vault.process`) | idempotency — second writer sees the id and no-ops | `FrontmatterDocIdStore.ts:83-87`, `CanvasDocIdStore.ts:38-43` |
| `DocIdBackfillService.inFlight` | one plugin | JOIN — second call receives the in-flight result | `DocIdBackfillService.ts:42-47` |

None of these are cross-plugin (module/instance state is per-bundle-copy — exactly the brief's point). The new **per-path window-global lock belongs INSIDE the library's `ensureId`**, wrapping read-decide-write; the brief's Map-tail-promise design (swallow predecessor rejection; `=== next` cleanup guard; release in `finally`, no expiry) is fully specified in `docs/migration/extraction-of-id.md` §Solution-1. Existing plugin-level guards remain valid outer layers: the drop guard cheaply suppresses same-plugin event storms (DROP), while the lock QUEUES cross-plugin contenders — different, compatible semantics. `getId` (read-only, heatmap bulk path over every vault file) must stay lock-free and cheap.

## 6. Submodule state

- `.gitmodules`: `submodules/obsidian-id-lib` → `git@github.com:nickolay-kondratyev/obsidian-id-lib.git`.
- Checked out at `7ece9a324c13` (`heads/main`); contents: `README.md` only (2 lines — states the purpose: multiple plugins creating IDs for notes/canvases with race reined in). No package.json, no tsconfig, no src — greenfield.
- Note the submodule README says "note/canvases" — canvases are in scope of the lib per that README, though the design brief only discusses frontmatter (see Q4).

## 7. Anchor points

Grep for `ap_..._E` / `ap.UUID.E` patterns across `src/`, `docs/`, root `*.md`: **zero matches**. No anchor points exist in or near docId code — nothing to preserve, and the extraction is a natural place to CREATE some (e.g. on the window-registry-key contract and the id-format contract).

## 8. Open questions / risks

1. `#QUESTION_FOR_HUMAN:` **`processFrontMatter` vs raw-text `Vault.process`.** The design brief (§"Idempotency backstop") mandates `app.fileManager.processFrontMatter` for all frontmatter writes, but the CURRENT code deliberately avoids it (committed owner decision, `FrontmatterDocIdStore.ts:30-35`: it re-serializes the whole frontmatter block and mangles formatting, e.g. strips quotes from keys we don't own). The brief's backstop goal is already met by the re-check inside the atomic `Vault.process` transform. Which mechanism should the LIBRARY use? (Recommendation: keep raw-text `Vault.process` + in-transform re-check; update the brief.)
2. `#QUESTION_FOR_HUMAN:` **Id format contract for the shared library.** Brief says "uuid/nanoid"; current generator is `docid_{24 base36 lowercase}_e` (crypto-random, collision-safe — satisfies the brief's intent) with legacy formats honored as-is. Should the library standardize on the existing `docid_..._e` scheme (this plugin's VH filenames and `DocIdFilenameSafety` depend on filename-safe ids), and is the OTHER plugin committed to accepting/producing it?
3. `#QUESTION_FOR_HUMAN:` **Library API shape.** Brief sketches free functions `getId(app, file)` / `ensureId(app, file)` taking `App`; current code is DI classes behind interfaces (only `cachedRead` + `process` needed), and house rules disfavor free-floating functions. Should the library expose DI-style classes (plugin wires them; a thin `app`-taking facade optional) or exactly the brief's function surface?
4. `#QUESTION_FOR_HUMAN:` **Canvas scope.** Does `CanvasDocIdStore` (id at `metadata.frontmatter.id`, canvas-JSON specifics, empty-file-as-new-canvas rule) move into the shared library, or does the lib cover md-frontmatter only with canvas staying plugin-local? (Submodule README mentions canvases; brief discusses only frontmatter.)
5. **Consumption + test-run mechanics** (PLANNING decision): npm `file:` dep vs tsconfig-paths vs relative import; whether lib tests run in the submodule's own vitest (needs its own obsidian mock + config) or the plugin's (needs `include`/alias widening). ESLint coverage of the submodule likewise.
6. **Drop-guard vs lock overlap**: `InFlightDropGuard` (DROP) in `DocIdFocusListener` and the new lock (QUEUE) coexist fine; decide whether the listener guard stays (cheap event-storm suppression) — low stakes.
7. **`ulid` is a declared runtime dependency but unused in `src/`** — follow-up ticket to drop it (also referenced in CLAUDE.md deps list).
8. **Cross-plugin backstop only holds if the other plugin cooperates**: `Vault.process` serializes writes, but the second writer must re-check inside its own callback (or via the lib). A third non-lib plugin writing blindly can still clobber — brief accepts this; the versioned `window` key + idempotent callback is the documented contract. The key name/shape must be treated as a public API (anchor-point + doc in the lib).
9. **Read-path performance**: heatmap calls `getDocId` for every vault file (`VisitHistoryServiceV3.ts:22-24`); the library's `getId` must remain read-only, lock-free, and `cachedRead`-based.
10. **Open ticket adjacency**: `docs/tickets/retry-doc-id-on-modify.md` (ensure-on-modify gap) — extraction should not close/expand it, but the lib API should not preclude it.
