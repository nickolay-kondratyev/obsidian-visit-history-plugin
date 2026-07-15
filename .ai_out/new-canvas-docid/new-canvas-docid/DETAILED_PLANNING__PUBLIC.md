# DETAILED PLAN — Brand-new canvas gets no doc id on focus

Bug: a brand-new `.canvas` file is an empty file (`""`); `JSON.parse("")` throws in
`CanvasDocIdStore.parseCanvas`, so `ensureId` returns `null` → no doc id → no V2 visit,
no V3 duration session (see EXPLORATION_PUBLIC.md).

## 1. Problem understanding

- **Goal**: empty/whitespace-only canvas content is treated as an empty canvas object `{}`;
  on first focus an id is generated and written, and the visit records normally.
- **Unchanged**: non-empty unparseable JSON keeps current behavior (return `null`,
  `console.error`, never write). Root-not-object (`[]`) keeps current behavior.
- **Out of scope** (human decision): retry-on-modify for canvases edited/synced while focused.
- **Assumption** (approved semantics): making a 0-byte canvas file non-empty on first focus is
  desired; resulting content is `{"metadata":{"frontmatter":{"id":"docid_..._E"}}}`-shaped JSON
  (tab-indented, matching `CANVAS_JSON_INDENT`).

## 2. Chosen approach (KISS / DRY analysis)

**Single change point: `CanvasDocIdStore.parseCanvas` short-circuits empty/whitespace content
to `{}` before `JSON.parse`.**

Why this is the right (and smallest) seam — `parseCanvas` is the ONLY parse entry, called from
all three paths, so one edit fixes all of them consistently:

1. `ensureId` precheck read → `{}` → id state `absent` → proceeds to write. ✔
2. **`ensureId`'s re-parse inside the atomic `Vault.process` callback** (the critical
   constraint) → `{}` → `writeId` runs → JSON is actually written. Handled automatically —
   no second fix needed, no silent no-op. ✔
3. `getId` (read-only heatmap/bulk path) → `{}` → id state `absent` → returns `null` with
   **no `console.error` noise** (short-circuit happens before the try/catch that logs).
   `getId` never writes — unchanged. ✔

Downstream effects requiring NO code change:
- `DocIdBackfillService` reuses the same `ensureDocId` path → empty canvases now get ids
  during backfill instead of landing in `failedPaths`. Desirable and consistent; document it.
- `DocIdFocusListener` / `VisitHistoryServiceV2` / `VhV3FocusDurationListener` need no changes:
  they already handle a non-null id correctly; the `null` gate simply stops firing for this case.

**Alternatives rejected**:
- Trim-check at each call site (`ensureId`, `process` callback, `getId`): 3 copies of the same
  business rule — DRY violation, and exactly the trap the exploration warns about.
- Normalizing in `NoteFileUtil` or `DocIdService`: wrong layer — "empty file means empty canvas"
  is canvas-format knowledge; md handles empty files its own way (`FrontmatterDocIdStore`).
- Focus-retry / vault-modify listener: out of scope per human decision.

## 3. Exact code changes

### 3.1 `src/core/service/docId/CanvasDocIdStore.ts` (only source file changed)

**(a)** In `parseCanvas`, before the `try { JSON.parse ... }`:

```ts
private parseCanvas(content: string, path: string): Record<string, unknown> | null {
  // A brand-new canvas is created by Obsidian as an EMPTY file — treat
  // empty/whitespace-only content as an empty canvas object so it can
  // receive a doc id on first focus (not as malformed JSON).
  if (content.trim() === '') {
    return {};
  }
  // ... existing try/catch unchanged ...
}
```

Notes:
- Returning a fresh `{}` per call is correct: `ensureId` re-parses inside the `process`
  callback anyway, and `writeId` mutates whatever object THAT parse returned before
  stringifying — no shared-state concern.
- No new constants needed (no magic values introduced).
- BOM edge case (covered for free): `String.prototype.trim()` strips U+FEFF (it is
  ECMAScript whitespace), so a BOM-only file counts as empty and gets an id;
  BOM-prefixed JSON (`'﻿{...}'`) still fails `JSON.parse` → `null` — pre-existing
  behavior, unchanged. A JSON `'null'` literal parses but fails the `isRecord` check
  ("root is not an object") — also unchanged.

**(b)** Update the class doc comment (currently "Malformed canvas JSON never throws — returns
null...") to also state: empty/whitespace-only content is treated as an empty canvas (`{}`) —
brand-new canvases get an id on first focus.

No other source files change. `DocIdStore`, `DocIdService`, listeners, backfill: untouched.

## 4. Test plan (`src/core/service/docId/CanvasDocIdStore.test.ts`)

Repo rule: bug fix STARTS with a failing test. Order of work:

### Step 1 — write/adjust tests first, run, confirm they FAIL

**Adjust the existing locked-in test (lines 164-175)** — human-approved inversion.
Replace `should return null for an empty canvas file without throwing or writing` with:

- `describe('ensureId')` → `it('should treat an empty canvas file as {} and write a generated id')`
  - GIVEN an empty file (brand-new canvas): `seedNote('boards/new.canvas', '')`
  - WHEN `ensureId(file)`
  - THEN (single combined assert, existing test style):
    - returned id `=== GENERATED_ID`
    - `parseContent(...)` equals `{ metadata: { frontmatter: { id: GENERATED_ID } } }`
    - `console.error` NOT called (spy call count 0) — locks in removal of the
      "malformed canvas JSON" noise for the normal just-created case

**New GIVEN/WHEN/THEN cases** (all in `describe('ensureId')` unless noted):

1. `it('should treat whitespace-only canvas content as {} and write a generated id')`
   — GIVEN `'  \n\t'`; THEN same shape as the empty-string case, no `console.error`.
2. `it('should write a generated id into an empty-object canvas')`
   — GIVEN `'{}'`; THEN parsed content `{ metadata: { frontmatter: { id: GENERATED_ID } } }`.
   (Closes the exploration's gap #2: `{}`-seeded new canvases.)
3. `describe('getId')` → `it('should return null for an empty canvas file without writing or logging')`
   — GIVEN `''`; WHEN `getId`; THEN `{ id: null, content: '', errorCalls: 0 }`
   (read-only path stays read-only and quiet).

### Step 2 — implement §3, re-run: new/adjusted tests pass

### Existing tests that MUST keep passing (unchanged)

- `getId`/`ensureId`: existing id returned, content byte-identical.
- `getId`: no id → `null`, read-only.
- `getId`/`ensureId`: malformed `'{not json'` → `null`, no write, no throw
  (regression guard: only EMPTY content changed semantics).
- `ensureId`: root-not-object `'[]'` → `null`.
- `ensureId`: write into existing frontmatter / create metadata when absent / preserve other
  data / numeric id as string / object-valued id not overwritten.
- Whole rest of the suite (listeners, `DocIdService`, `VisitHistoryServiceV2`,
  `DocIdBackfillService`) — no behavior contract they assert is touched.

### Acceptance criteria (automated)

1. `ensureId('')` returns a generated id AND file content becomes valid JSON equal to
   `{ metadata: { frontmatter: { id } } }` (proves the in-`process` re-parse also handled
   empty content — a precheck-only fix would return an id but leave the file empty, and the
   content assertion would fail).
2. `ensureId('  \n\t')` — same as (1).
3. `ensureId('{}')` — id written.
4. `getId('')` → `null`, file still `''`, zero `console.error` calls.
5. `ensureId('{not json')` / `getId('{not json')` → `null`, file unmodified (unchanged behavior).
6. Full suite green: `npm test`.

## 5. Doc updates

- **`CLAUDE.md`** (project) — "Malformed files never throw" bullet: append a succinct clause,
  e.g. "...returns `null` for unparseable content (empty/whitespace canvas is NOT malformed —
  it's a brand-new canvas and gets an id on first focus)". One line, stable knowledge.
- **`docs/architecture.md`** — "Doc id flow" Rules list: add one rule line:
  "Empty/whitespace-only canvas content (a brand-new canvas) is treated as an empty canvas
  `{}` — an id is written on first focus (and by backfill)."
- **`CanvasDocIdStore.ts` class doc** — per §3.1(b).

## 6. Verification steps

```bash
mkdir -p .tmp/
npm test        > .tmp/test.out  2>&1   # full suite green
npm run lint    > .tmp/lint.out  2>&1   # ZERO errors (repo standard)
npm run build   > .tmp/build.out 2>&1   # tsc + esbuild clean
```

Optional manual smoke (dev vault): create a new canvas → focus it → confirm the file gains
`metadata.frontmatter.id` and `.visit_history/user/<user>/v2/.../<doc-id>.vh_v2` gets a stamp,
with no console errors.

## 7. Risks / notes

- **Behavior change is deliberate**: first focus of a brand-new canvas now writes to the file
  (mtime churn on a file the user just created — negligible; the canvas view is about to write
  to it anyway). Approved in CLARIFICATION.
- **Canvas view overwrite race** (Obsidian's open canvas editor saving over our write before
  reloading): pre-existing concern inherent to writing ids into canvases; `Vault.process` is
  the sanctioned atomic path and no new exposure is added. Retry-on-modify is the out-of-scope
  follow-up that would harden this.
- No migration, no settings, no UI impact. Single-file source change keeps review trivial.

## 8. Open questions

None — all semantics were resolved in CLARIFICATION__PUBLIC.md.
