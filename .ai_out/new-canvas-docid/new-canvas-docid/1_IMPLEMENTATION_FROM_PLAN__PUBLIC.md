# IMPLEMENTATION — Brand-new canvas gets no doc id on focus

Branch: `new-canvas-docid`. NOT committed (TOP_LEVEL_AGENT handles git).

## Summary of changes

| File | Change | Why |
|---|---|---|
| `src/core/service/docId/CanvasDocIdStore.ts` | `parseCanvas` short-circuits empty/whitespace-only content to `{}` before `JSON.parse` (guard clause + WHY comment); class doc comment updated | The single parse seam — fixes `ensureId` precheck, the atomic `Vault.process` re-parse (critical constraint: no silent no-op), and `getId` in one edit. Plan §3.1. |
| `src/core/service/docId/CanvasDocIdStore.test.ts` | Approved inversion of the empty-canvas test (`null`/no-write → id written, JSON persisted, zero `console.error`); NEW tests: whitespace-only `'  \n\t'` → id written; `'{}'` → id written; `getId('')` → null, file untouched, zero `console.error` | Plan §4. Tests written FIRST and confirmed failing (see below). |
| `AGENTS.md` (= `CLAUDE.md`, symlink) | "Malformed files never throw" bullet: appended one clause — empty/whitespace canvas is NOT malformed, treated as `{}`, id on first focus | Plan §5. |
| `docs/architecture.md` | "Doc id flow" Rules list: added one rule line for the empty-canvas semantics (first focus + backfill) | Plan §5. |

No other source files changed (per plan: listeners, `DocIdService`, `DocIdBackfillService` untouched — the `null` gate simply stops firing for empty canvases; backfill now ids empty canvases via the shared `ensureDocId` path).

## Failing-test-first evidence (bug-fix rule)

Ran BEFORE the fix: `node node_modules/vitest/vitest.mjs run src/core/service/docId/CanvasDocIdStore.test.ts`
→ **3 failed | 12 passed** (`.tmp/test-failing.log`), each failing for the RIGHT reason:
- empty + whitespace `ensureId` cases: file content stayed empty → `parseContent` threw `SyntaxError: Unexpected end of JSON input` (no id written — the bug).
- `getId('')` case: `console.error` was called (empty treated as malformed — the noise being removed).
- The `'{}'` case passed pre-fix, exactly as the plan predicted (regression lock-in, not a bug repro).

## Verification (all after fix)

| Command | Result | Log |
|---|---|---|
| `npm test` | **336 passed (336), 40 files, 0 failed** — exit 0 | `.tmp/test.log` |
| `npm run lint` | **0 errors**, 2 warnings — exit 0. Warnings are PRE-EXISTING `obsidianmd/prefer-active-doc` in window-monitor code, untouched by this change | `.tmp/lint.log` |
| `npm run build` | tsc + esbuild clean — exit 0 | `.tmp/build.log` |

Targeted suite: `CanvasDocIdStore.test.ts` → 15/15 pass (`.tmp/test-fixed.log`).

## Plan deviations

**None.** Implementation matches DETAILED_PLANNING__PUBLIC.md §3–§5 exactly, including the reviewer's inline notes. Only removed behavior assertion is the human-approved inversion (+ its entailed `console.error`-silence for empty content, locked in by tests per plan).

## For the reviewer to scrutinize

- The inverted test at `CanvasDocIdStore.test.ts` (`should treat an empty canvas file as {} and write a generated id`) asserts persisted file content — this is the tripwire proving the in-`process` re-parse handles empty content (a precheck-only fix would fail it).
- `getId` empty-content silence (no `console.error`) is a deliberate, tested behavior change entailed by the approved semantics.
- Dev-env note (environment, not code): the interactive shell profile shadows `node`/`npx` with a broken nvm lazy-load shim; commands were run via `/usr/local/bin/node` / `/usr/local/bin/npm` (node v26.5.0). Follow-up for the env owner, not this repo.
