# IMPLEMENTATION REVIEW — Brand-new canvas gets doc id on first focus

Reviewed commit: `4783ad5` on branch `new-canvas-docid`.

## Verdict: **APPROVED**

## Summary

Minimal, correctly placed fix: `CanvasDocIdStore.parseCanvas` short-circuits
empty/whitespace-only content to `{}` before `JSON.parse`. Because `parseCanvas`
is the single parse seam, one edit consistently fixes all three paths:

1. **`ensureId` precheck** — empty → `{}` → id state `absent` → proceeds to write. ✔
2. **Re-parse inside the atomic `Vault.process` callback** (the critical
   constraint from CLARIFICATION — a precheck-only fix would silently no-op) —
   empty → `{}` → `writeId` runs → JSON actually persisted. ✔ The inverted test
   asserts the PERSISTED file content parses to
   `{ metadata: { frontmatter: { id } } }`, which is exactly the tripwire that
   would catch a precheck-only fix.
3. **`getId`** (read-only heatmap/bulk path) — empty → `null`, no write, no
   `console.error` noise; locked in by a new test asserting
   `{ id: null, content: '', errorCalls: 0 }`. ✔

Non-empty unparseable JSON keeps the approved behavior — `console.error` +
`null`, file never overwritten — and the pre-existing regression tests for
`'{not json'` (both `getId` and `ensureId`) and root-not-object `'[]'` are
untouched. The only removed assertion is the ONE human-approved inversion
(empty canvas: `null`/no-write → id written). No scope creep: source change is
one guard clause + doc comment; listeners/`DocIdService`/backfill untouched as
planned. Matches the approved plan (DETAILED_PLANNING__PUBLIC.md §3–§5) exactly.

## Independent verification (re-run, not trusted from claims)

Environment note confirmed: the shell profile shadows `node`/`npx` with a broken
nvm shim; ran via `/usr/local/bin/npm`.

| Command | Result |
|---|---|
| `npm test` | **336 passed (336), 40 files, exit 0** (`.tmp/rev_test.log`) |
| `npm run lint` | **0 errors**, 2 warnings, exit 0 — warnings are PRE-existing `obsidianmd/prefer-active-doc` in window-monitor code, unrelated to this change (`.tmp/rev_lint.log`) |
| `npm run build` | tsc + esbuild clean, exit 0 (`.tmp/rev_build.log`) |

No `sanity_check.sh` exists in this repo (checked).

Additional checks performed:
- `FakeNoteFileUtil.process` genuinely applies the transform to stored content —
  the file-content assertions prove the write happened, not just the returned id.
- Grepped for other empty-canvas assumptions: `DocIdBackfillService` tests use
  non-empty malformed `'not json at all'` — behavior contract unaffected; empty
  canvases now succeeding in backfill is the planned, documented downstream effect.
- Docs: `AGENTS.md` edit IS the `CLAUDE.md` update (CLAUDE.md is a symlink to
  AGENTS.md — verified with `ls -la`); the appended clause, the
  `docs/architecture.md` rule line, and the class doc are accurate and succinct.
- TypeScript rules: no `as` casts, explicit return types preserved, no enums,
  no anchor-point removals.
- BOM edge: `trim()` strips U+FEFF (ECMAScript whitespace), so a BOM-only file
  counts as empty — as the plan stated.

## Feedback

### BLOCKING
None.

### IMPORTANT
None. (The canvas-editor overwrite race — Obsidian's open canvas view saving
over the freshly written id — is pre-existing exposure, explicitly declared out
of scope by the human with retry-on-modify as the follow-up. No new exposure
added.)

### NIT
1. `CanvasDocIdStore.test.ts` — `'should write a generated id into an
   empty-object canvas'` (the `'{}'` case) asserts only persisted content, not
   the returned id, unlike the sibling empty/whitespace cases that use the
   combined-object assert. Harmless asymmetry (content assertion subsumes the
   id); matches the plan's own wording, so no action required.
2. The `getId`-empty test could additionally assert
   `noteFileUtil.processCallCount === 0` for a stronger "read-only path never
   writes" statement, though `content: ''` already covers the observable effect.

## Documentation Updates Needed
None beyond what the commit already includes — CLAUDE.md (via AGENTS.md
symlink), docs/architecture.md, and the class doc are all updated and accurate.
