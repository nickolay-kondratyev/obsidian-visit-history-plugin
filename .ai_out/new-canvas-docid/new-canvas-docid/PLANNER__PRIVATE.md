# PLANNER PRIVATE MEMORY — new-canvas-docid

Status: DONE. Deliverable written to DETAILED_PLANNING__PUBLIC.md in this dir.

## What I verified by reading code (do not re-derive)

- `src/core/service/docId/CanvasDocIdStore.ts`: `parseCanvas(content, path)` is the SINGLE
  parse entry used by (1) `ensureId` precheck (line ~24), (2) the re-parse inside the
  `noteFileUtil.process` callback (line ~38), (3) `getId` (line ~49). So the whole fix is a
  trim-empty short-circuit `if (content.trim() === '') return {};` at the TOP of `parseCanvas`,
  before the try/catch (so no console.error fires for empty). Fresh `{}` per call is safe:
  process-callback re-parses and `writeId` mutates that instance before stringify.
- `writeId` creates metadata/frontmatter as needed → empty file becomes
  `{"metadata":{"frontmatter":{"id":GENERATED}}}` stringified with `CANVAS_JSON_INDENT = '\t'`.
- Test file `CanvasDocIdStore.test.ts`: uses `setup()` returning {store, noteFileUtil(Fake)},
  `FixedDocIdGenerator`, `GENERATED_ID = 'docid_BBBBBBBBBBBBBBBBBBBBB_E'`, `parseContent()`
  helper, combined-object single-expect style, console.error spies via vi.spyOn. The test to
  invert is at lines 164-175 ('should return null for an empty canvas file...').
- `docs/architecture.md` "Doc id flow" Rules list (~lines 140-150) is where the doc rule goes;
  backfill section ~152-158 notes backfill reuses same ensureDocId path (so empty canvases get
  ids in backfill automatically — documented as desirable, no code change).
- grep: no "empty" mention in DocIdBackfillService.ts or docs/ relevant to this; no other doc
  needs touching besides CLAUDE.md "Malformed files never throw" bullet + architecture.md +
  class doc comment.

## Key decisions in the plan

- Single change point in parseCanvas (DRY); rejected per-call-site trims, NoteFileUtil layer,
  retry-on-modify (out of scope per human).
- getId('') → null quietly (no error log), never writes — covered by new test.
- Test order: failing-first (adjust locked-in test + add whitespace-only, '{}', getId-empty
  cases), then implement, then npm test/lint/build redirected to .tmp/.
- Acceptance criterion #1 deliberately asserts FILE CONTENT (not just returned id) to prove the
  in-process re-parse handled empty content (guards against precheck-only fix silently no-oping
  the write).

## If rehydrated

Plan is complete and self-contained; nothing pending. If asked to revise: the only debatable
points are (a) whether to assert exact tab-indented bytes (I chose parse-based assertions,
consistent with existing tests), (b) whether CLAUDE.md wording clause is succinct enough.
