# PRIVATE working notes — EXPLORATION (extract-id-lib / move-id-out)

Rehydration notes for a clone of me. PUBLIC report: ./EXPLORATION__PUBLIC.md (that's the deliverable; this is raw context).

## What I read (files, fully or in relevant part)
- docs/migration/extraction-of-id.md — the whole brief (39 lines). Key: window lock registry `Map<path,Promise>` on versioned window key; uuid/nanoid; processFrontMatter backstop; API `getId(app,file)`/`ensureId(app,file)`; contracts = window key + fm id field/format.
- src/core/service/docId/* — all 6 source files fully read (DocIdService 64L, DocIdStore 45L, DocIdGenerator 44L, FrontmatterDocIdStore 149L, CanvasDocIdStore 105L, DocIdBackfillService 75L).
- src/core/util/file/note/NoteFileUtil.ts + impl/NoteFileUtilDefault.ts — stores use ONLY cachedRead + process. Impl = app.vault.cachedRead / app.vault.process.
- src/core/focusTracker/listener/DocIdFocusListener.ts, VhV3FocusDurationListener.ts; FocusTracker.ts lines 50-66 (dispatchChain comment).
- src/core/util/async/InFlightDropGuard.ts (DROP semantics, per-key Map).
- src/core/service/visitHistoryService/DocIdFilenameSafety.ts (regex, 200 char), v3/VisitHistoryServiceV3.ts (getDocId at line 23, max-merge cache race note).
- src/core/init/PluginFactory.ts full — docId wiring lines 59-63, listener order 83-86, backfill 94.
- package.json, tsconfig.json, esbuild.config.mjs, vitest.config.ts, src/testSupport/obsidianMock.ts full.
- Heads of DocIdBackfillService.integration.test.ts; grep of test imports.
- docs/tickets listing; read retry-doc-id-on-modify.md head.

## Key grep results (repro commands)
- Consumers: `grep -rn "from ['\"].*docId" src --include="*.ts" | grep -v "^src/core/service/docId"` → DocIdFocusListener(.test), VhV3FocusDurationListener, PluginFactory (5 imports), VisitHistoryServiceV3, VisitHistorySettingTab (DocIdBackfillService+Result), testSupport/fakes.ts.
- `grep -rn ulid src` → ZERO hits. ulid ^3.0.2 in package.json dependencies = unused. (CLAUDE.md lists it as a dep too.)
- Anchor points: `grep -rn "ap_" src docs *.md | grep -c "ap_.*_E"` → 0. None exist anywhere near docId.
- main.ts:44 passes factory.docIdBackfillService to settings tab.

## Submodule facts
- .gitmodules: submodules/obsidian-id-lib → git@github.com:nickolay-kondratyev/obsidian-id-lib.git
- `git submodule status` → 7ece9a324c135fc07ae0d62dd505679cef9db1de (heads/main). Contents: README.md ONLY (says "note/canvases" — canvas seemingly in lib scope, tension w/ brief which is fm-only).
- Added in commit c863da5 together with docs/migration/extraction-of-id.md.

## Reasoning behind the flagged tensions
1. processFrontMatter: brief §3 mandates it; FrontmatterDocIdStore.ts:30-35 WHY comment forbids it (re-serializes whole block, strips quotes from keys like `"some key": v`). The brief's real goal (idempotency backstop) already achieved by re-check inside Vault.process transform (FrontmatterDocIdStore.writeIdIntoContent lines 83-87; CanvasDocIdStore.ensureId lines 38-43). Vault.process is the same Vault instance for all plugins → its transform runs atomically vs other Vault writes. So recommendation = keep raw-text; but only safe cross-plugin if OTHER plugin also re-checks in its callback (processFrontMatter callback checking `if (fm.id) return` gives the same property on their side).
2. Format: brief says uuid/nanoid; actual = docid_{24 base36 lc}_e, hand-rolled rejection sampling (MAX_UNBIASED_BYTE_EXCLUSIVE=252). Legacy uppercase base62 docid_{21}_E honored as-is. VH filenames = `<id>.vh_v3` → DocIdFilenameSafety constraint. uuid/nanoid default alphabets: nanoid has `-`/`_` (filename-safe) but uuid fine too; still, changing format breaks nothing for existing files (existing ids honored) but the CONTRACT for the other plugin must be settled.
3. API shape: brief = free functions taking `app`; house rules (CLAUDE.md global) = disfavor free-floating functions, DI/interfaces. Lib could export classes + thin facade.
4. Canvas: brief silent, submodule README mentions canvases. DocIdService dispatch-by-extension + isEligible probably moves too if canvas moves; else lib = FrontmatterDocIdStore-equivalent only and plugin keeps dispatch.

## Packaging notes (details behind PUBLIC §4)
- esbuild externals include ...builtinModules and 'obsidian' — lib gets bundled per-plugin; obsidian stays external. obsidian devDep pinned "latest", types-only (no runtime JS — hence vitest alias to src/testSupport/obsidianMock.ts which has TFile/TAbstractFile/TFolder/normalizePath/Notice only).
- tsconfig include = src/**/*.ts only; tsc will still typecheck files reached via imports outside include (they're program files), but eslint config + editor projects may need explicit handling. `npm file:` deps to directories are symlinked by npm (v5+) → esbuild/vitest resolve fine; lib then needs its own package.json (name, main/types, obsidian as peer/dev).
- vitest test.include = src/**/*.test.ts(x) → submodule tests invisible to plugin runner. Options: widen include + reuse alias, or lib self-hosts vitest + its own mock (duplication of obsidianMock — DRY tension worth calling out in PLANNING).
- Lint: `eslint .` at root; submodule would be swept in; likely needs ignore entry or own config.

## Locking map (PUBLIC §5 table backing)
- FocusTracker.dispatchChain (FocusTracker.ts:60, comment 54-59). whenIdle() exists at :82 (used for unload flush presumably).
- DocIdFocusListener uses InFlightDropGuard.run(path, ...) at :21; VhV3FocusDurationListener deliberately has NO guard (relies on serialized dispatch — comment lines 10-11).
- Backfill JOIN via `this.inFlight ??=` (DocIdBackfillService.ts:43).
- New window lock: belongs in lib ensureId around read+process; getId must stay lock-free (heatmap bulk: VisitHistoryServiceV3.getLastVisitStamp per vault file).

## Deliberate scoping decisions I made
- Did NOT read heatmap/view code beyond VisitHistoryServiceV3 (read path is the only docId toucher there).
- Did NOT read FocusDurationTracker/WindowActivityMonitor in depth — irrelevant to extraction beyond listener ordering.
- Did not run tests/build (read-only task; no code changed).
- Shell noise: every Bash call prints ~30 lines of env-setup boilerplate (zellij symlink etc.) — ignore it; grep "0 matches" can look empty amid the noise, verified anchor-point absence with an explicit `grep -c` → 0.

## Ticket adjacency spotted
- docs/tickets/retry-doc-id-on-modify.md (OPEN): ensure-on-modify gap, owner-scoped-out. Lib API shouldn't preclude calling ensureId from a modify handler.
- docs/tickets/1_must-add-user-id.md exists (didn't read) — possibly related to user scoping, not doc id.

## Final message constraints given to me
Reply = 5-10 line summary + PUBLIC path + #QUESTION_FOR_HUMAN items verbatim. 4 such questions in PUBLIC §8 (items 1-4).
