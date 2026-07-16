# PLAN_REVIEWER private memory — extract-id-lib / move-id-out

## State (2026-07-16)
- Reviewed DETAILED_PLANNING__PUBLIC.md v1. Verdict: APPROVED WITH MINOR REVISIONS (applied inline). PLAN_ITERATION CAN BE SKIPPED.
- Review written to DETAILED_PLAN_REVIEW__PUBLIC.md.

## Facts I verified against the repo (don't re-verify)
- PluginFactory.ts:59-63 = generator + 2 stores + DocIdServiceDefault wiring; listener order docid-first at :83.
- NoteFileUtil has exactly cachedRead(file):Promise<string> + process(file, transform):Promise<void> among 4 methods → structurally satisfies planned FileContentAccess; FakeNoteFileUtil too.
- tsconfig: strict, ES2021, moduleResolution node, isolatedModules, noUncheckedIndexedAccess, skipLibCheck (only skips .d.ts → raw-TS lib IS strict-checked via types→src/index.ts), include src/**/*.ts.
- vitest.config: alias obsidian→testSupport/obsidianMock.ts; include src/**/*.test.ts(x). vitest 4. `test.server.deps.inline` fallback notation OK.
- eslint.config.mts uses globalIgnores([...]) — adding 'submodules' is the right mechanism.
- package.json: ulid ^3.0.2 in deps (unused in src — confirmed by exploration grep); "type":"module".
- [VHP] prefix: CanvasDocIdStore (moves → becomes [obsidian-id-lib]) + DocIdBackfillService (STAYS, keeps [VHP]).
- Submodule at 7ece9a3, README.md only, remote git@github.com:nickolay-kondratyev/obsidian-id-lib.git.
- D3 lock algorithm traced: correct vs brief (never-rejecting stored tail, swallow predecessor rejection, ===next cleanup, implicit finally via tail settle, no expiry, plain Map/Promise on versioned globalThis key). Sync get/set → no creation race. No deadlock with DropGuard(DROP)/FocusTracker chain/backfill JOIN (no nested same-path acquisition; no await cycle).
- AC-S1 nuance: with working lock the SECOND writer bails at the fast-path cachedRead, not the in-transform re-check (backstop only observable when lock bypassed; store tests cover it = AC-B7). Fixed the wording inline.

## Inline edits I made to the plan (3)
1. Phase 3.1: added `"test:lib": "npm --prefix submodules/obsidian-id-lib run test"` script; Phase 4.3 CLAUDE.md dev-env mention of it.
2. AC-S1 reworded (fast-path vs backstop layers).
3. D2 facade: transparency NOTE that Q3 said "app-taking" while plan takes Vault (deliberate narrowing, one-line adoption preserved). Flagged, not blocking.

## Judgement calls (stand by these if re-litigated)
- Facade Vault-vs-App: NOT worth a human question or iteration; intent honored. If human objects, widen facade only.
- Lib skipping ESLint v1 with follow-up ticket in README: acceptable PARETO (code arrives lint-clean).
- Plugin npm test not running lib tests: mitigated by test:lib script + retained integration test; not MAJOR.
- No expiry on lock = binding (brief non-goal); wedged-foreign-tail risk accepted by design.

## If a v2 plan arrives
Diff it against these anchors: D1 packaging, D3 algorithm + placement (required PathLock ctor param, getDocId lock-free), D4 move/stay table, AC list (L1-L7, S1-S3, B1-B7, P1-P6), D5 push-order caveat. Anything weakening the lock contract semantics or dropping moved tests = MAJOR.
