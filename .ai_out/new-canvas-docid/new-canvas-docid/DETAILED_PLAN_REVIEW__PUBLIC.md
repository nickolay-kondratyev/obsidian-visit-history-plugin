# DETAILED PLAN REVIEW — Brand-new canvas gets no doc id on focus

Plan reviewed: `DETAILED_PLANNING__PUBLIC.md` (against actual code:
`CanvasDocIdStore.ts`, `CanvasDocIdStore.test.ts`, `DocIdService.ts`,
`DocIdBackfillService.ts`, `FakeNoteFileUtil.ts`, `docs/architecture.md`, project `CLAUDE.md`).

## Verdict

**APPROVED** (with one minor inline adjustment). **PLAN_ITERATION can be skipped.**

## Executive summary

The plan is a textbook PARETO fix: one guard clause at the single parse seam
(`parseCanvas`) that provably covers all three consumers. I verified against the code that
`parseCanvas` is the ONLY `JSON.parse` entry (called from the `ensureId` precheck at
`CanvasDocIdStore.ts:24`, the atomic `Vault.process` re-parse at `:38`, and `getId` at `:49`),
so the critical constraint from CLARIFICATION (the in-`process` re-parse must also treat empty
as `{}`) is satisfied by construction, not by a second patch. Test plan follows repo
conventions and its acceptance criteria are mechanically sound.

## Correctness verification (per review charter)

| Path | Verified behavior after fix |
|---|---|
| `ensureId` precheck (`:24`) | `''`/whitespace → `{}` → id state `absent` → proceeds to write. Correct. |
| Atomic `Vault.process` re-parse (`:38`) | Same short-circuit → `writeId` runs → JSON actually persisted. No silent no-op. Correct. |
| `getId` (`:49`) | `{}` → `absent` → `null`, no write, and no `console.error` (short-circuit precedes the logging try/catch). Correct. |

Edge cases checked:
- **Whitespace variants** (`'  \n\t'`): handled by `trim()`; test case planned. ✔
- **BOM**: `trim()` strips U+FEFF (ECMAScript whitespace) → BOM-only file counts as empty
  and gets an id; BOM-prefixed JSON still fails `JSON.parse` → `null` (pre-existing,
  unchanged). ✔ (added as inline note, see below)
- **JSON `null` literal** (`'null'`): parses, fails `isRecord` → "root is not an object" →
  `null`. Unchanged; existing `'[]'` test guards this family. ✔
- **`'{}'`-seeded canvas**: already works today via `writeId`; plan adds an explicit test
  closing exploration gap #2. ✔
- **Acceptance criterion 1 is a real tripwire**: `FakeNoteFileUtil.process` invokes the
  transform with current content, so a precheck-only fix would leave the file `''` and the
  content assertion would fail. Verified against `FakeNoteFileUtil.ts:60-67`. ✔
- **Downstream no-change claims verified**: `DocIdBackfillService` reuses `ensureDocId`
  (`DocIdBackfillService.ts:69`) — empty canvases move from `failedPaths` to id'd, which the
  plan documents; `VisitHistoryServiceV2`'s null gate simply stops firing. ✔

## Feedback points

1. **MINOR (fixed-inline)** — BOM / `'null'`-literal edge cases were unaddressed in the plan.
   Added a note to §3.1: `trim()` covers BOM-only files for free; BOM+JSON and `'null'`
   literal keep pre-existing behavior. No code or test change required (PARETO — not worth
   dedicated test cases).
2. **MINOR (accepted as-is, no change)** — `getId` silence for empty content is a behavior
   change slightly beyond the literal test inversion (today `getId('')` logs
   `console.error`). It is directly entailed by the approved semantics ("empty is NOT
   malformed") and the plan calls it out explicitly with a test locking it in. No action.
3. **MINOR (accepted as-is, no change)** — `content.trim()` allocates a copy per parse of
   every canvas read. Negligible next to `JSON.parse` on the same string; a first-non-ws-char
   scan would be over-engineering. No action.

## Checks against repo standards

- **KISS/PARETO**: single guard clause, single source file, zero new abstractions. Rejected
  alternatives (per-call-site trim = 3x DRY violation; `NoteFileUtil`/`DocIdService` layer =
  wrong owner of canvas-format knowledge) are correctly analyzed.
- **DRY/SRP**: "empty file means empty canvas" lives in exactly one place, in the class that
  owns the canvas format. ✔
- **Test plan**: failing-test-first ordering, mirrored test file, GIVEN/WHEN/THEN, single
  combined `expect` matching existing suite style, regression guards enumerated (malformed
  `'{not json'`, `'[]'`, byte-identical existing-id reads). The approved test inversion is the
  only removed behavior assertion. ✔
- **Doc updates**: both targets verified to exist — `docs/architecture.md` "Doc id flow"
  Rules list (line ~140) and project `CLAUDE.md` "Malformed files never throw" bullet;
  proposed one-liners are succinct and stable-knowledge. Class doc update per §3.1(b). ✔
- **No behavior removals** beyond the human-approved inversion (+ its entailed log-noise
  removal, explicitly tested). ✔

## Inline adjustments made to DETAILED_PLANNING__PUBLIC.md

- §3.1 Notes: added the BOM / `'null'`-literal edge-case note (non-contentious factual
  clarification; no directional change).

## Strengths

- The plan's central argument ("single parse seam ⇒ all three paths fixed at once") is
  verifiable from the code in one read — exactly the shape of fix this bug wants.
- Acceptance criteria are designed to catch the specific failure mode the exploration warned
  about (silent no-op inside `process`), not just the happy path.
- Risk section honestly surfaces the canvas-editor overwrite race as pre-existing and defers
  hardening to the already-scoped-out follow-up.
