# IMPLEMENTATION PRIVATE — new-canvas-docid (state for future clone)

## Status: COMPLETE. Not committed (TOP_LEVEL_AGENT does git).

## What was done (in order)
1. Read plan/review/clarification files. Plan = single guard clause in `parseCanvas`.
2. Tests FIRST (`src/core/service/docId/CanvasDocIdStore.test.ts`):
   - Inverted lines-164-175 test → `should treat an empty canvas file as {} and write a generated id` (asserts id + parsed content + errorCalls:0).
   - Added: whitespace-only `'  \n\t'` ensureId; `'{}'` ensureId; `getId('')` → {id:null, content:'', errorCalls:0}.
   - Confirmed 3 failed for right reason (empty file → parseContent SyntaxError; getId logged error). `'{}'` passed pre-fix as plan predicted. Log: .tmp/test-failing.log
3. Fix (`src/core/service/docId/CanvasDocIdStore.ts`):
   - `parseCanvas`: `if (content.trim() === '') { return {}; }` before try/JSON.parse, with WHY comment.
   - Class doc: added empty/whitespace = empty canvas sentence.
4. Docs: AGENTS.md (CLAUDE.md is a SYMLINK to AGENTS.md — Edit tool refuses symlink, edit AGENTS.md directly) "Malformed files never throw" bullet + docs/architecture.md Rules list (after the unusable-id-slot bullet).
5. Verified: npm test 336/336 pass; lint 0 errors (2 pre-existing prefer-active-doc warnings, not mine); build clean.

## Environment gotchas (IMPORTANT for rehydration)
- Interactive bash profile shadows `node`/`npx` with a broken nvm lazy-shim ("/home/node/.nvm/nvm.sh NOT found") → commands silently produce no output.
  WORKAROUND: use `/usr/local/bin/node`, `/usr/local/bin/npm` explicitly. node v26.5.0.
- Vitest direct: `/usr/local/bin/node node_modules/vitest/vitest.mjs run <file>`.
- Shell prints ~25 lines of profile noise per Bash call — always redirect real output to .tmp/ and grep it (grep with -a; logs contain ANSI).
- .tmp/ has a giant unrelated git_save_1.log (2.6GB) — ignore.

## Deliverable
.ai_out/new-canvas-docid/new-canvas-docid/1_IMPLEMENTATION_FROM_PLAN__PUBLIC.md — written, complete.

## Open questions for human
None.
