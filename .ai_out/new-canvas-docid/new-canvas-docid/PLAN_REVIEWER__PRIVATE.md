# PLAN_REVIEWER private notes (rehydration)

Session: 2026-07-15. Reviewed DETAILED_PLANNING__PUBLIC.md for the new-canvas-docid bug.

## State
- Verdict: APPROVED, PLAN_ITERATION skippable. Deliverable written:
  DETAILED_PLAN_REVIEW__PUBLIC.md.
- Inline edit made to DETAILED_PLANNING__PUBLIC.md §3.1 Notes: added BOM/`'null'`-literal
  edge-case note (trim() strips U+FEFF; BOM+JSON stays malformed; 'null' literal fails
  isRecord — all pre-existing behavior, unchanged).

## Key verifications (so I don't redo them)
- `parseCanvas` is the ONLY JSON.parse entry in CanvasDocIdStore (called at lines 24, 38, 49)
  → single guard clause covers precheck, in-process re-parse, and getId.
- FakeNoteFileUtil.process (testSupport) passes current content to the transform → the plan's
  acceptance criterion 1 (content assertion catches precheck-only fix) is mechanically valid.
- DocIdBackfillService.ensureIdSafely → ensureDocId → same path; empty canvases will move
  out of failedPaths (plan documents it in architecture.md rule line).
- Doc targets exist: docs/architecture.md "Doc id flow" Rules (~line 140); project CLAUDE.md
  "Malformed files never throw" bullet.
- Behavior changes beyond test inversion: getId('') stops logging console.error — entailed by
  approved semantics, plan tests it explicitly. Accepted.

## If re-reviewing after implementation
- Check the guard is in parseCanvas (not per call site), comment explains WHY (brand-new
  canvas = empty file), class doc updated, and the old locked-in test at
  CanvasDocIdStore.test.ts:164-175 is inverted (not deleted without replacement).
