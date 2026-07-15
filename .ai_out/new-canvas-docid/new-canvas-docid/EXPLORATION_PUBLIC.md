# EXPLORATION: New Canvas Doc Id / Visit History Bug

(Authored by read-only Explore sub-agent; transcribed by TOP_LEVEL_AGENT.)

## ROOT CAUSE

A brand-new `.canvas` file created by Obsidian is written as an **empty file (empty string `""`)**. When it first receives focus, `CanvasDocIdStore.parseCanvas` calls `JSON.parse("")`, which **throws**, so `parseCanvas` returns `null`, so `ensureId` returns `null` → no doc id is written → the visit-history recorder bails out. Nothing retries, so no id and no visit are ever recorded for that first focus.

Guilty logic — `src/core/service/docId/CanvasDocIdStore.ts:23-46, 59-71`:

```ts
async ensureId(file: TFile): Promise<string | null> {
  const canvas = this.parseCanvas(await this.noteFileUtil.cachedRead(file), file.path);
  if (canvas === null) {        // ← empty "" → parse throws → null → bail
    return null;
  }
  ...
}

private parseCanvas(content: string, path: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);   // JSON.parse("") throws
    if (this.isRecord(parsed)) return parsed;
    console.error(`[VHP][CanvasDocIdStore] canvas root is not an object ...`);
    return null;
  } catch (error) {
    console.error(`[VHP][CanvasDocIdStore] malformed canvas JSON ...`, error);
    return null;                                    // ← empty file lands here
  }
}
```

This is intentional, documented, and **explicitly tested** as the current behavior — `src/core/service/docId/CanvasDocIdStore.test.ts:164-175`:

```ts
it('should return null for an empty canvas file without throwing or writing', async () => {
  // GIVEN an empty file (e.g. canvas just being created)
  ...
  const file = noteFileUtil.seedNote('boards/new.canvas', '');
  const id = await store.ensureId(file);
  expect({ id, content: ... }).toEqual({ id: null, content: '' });
});
```

The comment "e.g. canvas just being created" confirms a brand-new canvas is an empty string; the store deliberately returns `null` and writes nothing for it. Fixing the bug means treating empty/whitespace-only canvas content as an empty canvas object (`{}`) and generating an id, rather than returning `null`.

## Full focus → docid → visit-record flow

1. **`FocusTracker`** (`src/core/focusTracker/FocusTracker.ts:66-75`) subscribes to Obsidian's `active-leaf-change`. On each change it builds a `FocusEvent` for tracked views (`handleLeafChange`, line 88) and dispatches `onFocus`/`onUnfocus` to all listeners serially through `dispatchChain`.
2. Listeners are registered in this order (`src/core/init/PluginFactory.ts:92-98`):
   - **`DocIdFocusListener`** (first) — `src/core/focusTracker/listener/DocIdFocusListener.ts:16-24`: `await docIdService.ensureDocId(event.file)` (result discarded), wrapped in an `InFlightDropGuard` keyed by file path.
   - **`VisitHistoryFocusListenerDefault`** — `.../VisitHistoryFocusListenerDefault.ts:16-24`: `await visitHistoryService.recordVisitNowOnFocus(event.file)`, also guarded.
   - **`VhV3FocusDurationListener`** — `.../VhV3FocusDurationListener.ts:21-45`: resolves the doc id again and starts/stops a duration session.
3. **`DocIdServiceDefault.ensureDocId`** (`src/core/service/docId/DocIdService.ts:45-51`) dispatches by extension: `md`→`FrontmatterDocIdStore`, `canvas`→`CanvasDocIdStore`; unknown extensions → `null`.
4. **`VisitHistoryServiceV2.recordVisitNowOnFocus`** (`src/core/service/visitHistoryService/v2/VisitHistoryServiceV2.ts:66-90`) calls `ensureDocId` itself and **gates on the result**:

```ts
const docId = await this.docIdService.ensureDocId(file);
if (docId === null) {                 // ← no id ⇒ no visit recorded
  return;
}
```

So a `null` doc id is a hard stop for visit recording — confirmed at `VisitHistoryServiceV2.ts:70-73`. The V3 duration listener behaves the same way (`VhV3FocusDurationListener.ts:36-42`: `null` id → `onDocUnfocused()`, no session).

## Step-by-step: brand-new canvas

1. User creates a new canvas → Obsidian writes an **empty file** (`""`) and focuses it.
2. `active-leaf-change` fires → `FocusTracker` builds a `FocusEvent` (type `canvas`) → dispatches `onFocus`.
3. `DocIdFocusListener.onFocus` → `ensureDocId` → `CanvasDocIdStore.ensureId` → `parseCanvas("")` → `JSON.parse("")` throws → `null` → **no id written**.
4. `VisitHistoryFocusListenerDefault.onFocus` → `recordVisitNowOnFocus` → `ensureDocId` again → `null` → **early return, no visit appended**.
5. `VhV3FocusDurationListener.onFocus` → `null` id → `onDocUnfocused()`, **no duration session**.
6. Result: brand-new canvas has no id, no V2 visit, no V3 duration.

**Whether it self-heals later:** There is **no automatic retry on content change**. The only doc-id triggers are (a) focus events and (b) the manual "backfill" action. So:
- If the user adds a node (canvas becomes valid JSON) and then re-focuses it (switch away and back), the next `onFocus` re-runs `ensureId`, which now parses successfully and writes an id, and the visit gets recorded then. But `active-leaf-change` does **not** re-fire just because the file content changed while it stays focused.
- Manual **`DocIdBackfillService.backfillAll`** would still return `null` for a still-empty canvas (same `ensureId` path) and list it in `failedPaths`.

Contrast — **markdown does NOT have this bug**: `FrontmatterDocIdStore.writeIdIntoContent` (`src/core/service/docId/FrontmatterDocIdStore.ts:81-101`) handles an empty string by *creating* a frontmatter block. So a brand-new empty `.md` note gets an id on first focus; a brand-new `.canvas` does not. This asymmetry is the crux.

## Existing test coverage relevant to this area

- **`CanvasDocIdStore.test.ts`** — covers: existing id read, missing id → `null` for getId, malformed JSON `'{not json'` → `null`, **empty file `''` → `null` (lines 164-175, the exact bug behavior, locked in as expected)**, root not an object `'[]'` → `null`, numeric id → string, object-valued id not overwritten, create-metadata-when-absent, preserve other data. Notably **no** test for whitespace-only content and **no** test asserting an empty canvas *should* get an id.
- **`DocIdService.test.ts`** — extension dispatch only; uses fake stores, doesn't exercise the empty-content path.
- **`DocIdFocusListener.test.ts`** — ensureDocId called on focus, in-flight dedup, drops empty-path events.
- **`VisitHistoryServiceV2.test.ts`** — `recordVisitNowOnFocus` behavior (null docId gate at `VisitHistoryServiceV2.ts:71-73`).
- `FrontmatterDocIdStore.test.ts` — shows the markdown empty/no-frontmatter path that *does* create an id (the asymmetry).

## Secondary issues noticed

1. **Whitespace-only canvas** (`"   "`, `"\n"`) also throws in `JSON.parse` → `null`. Not tested. A fix should trim first.
2. **`"{}"`-content canvas works, `""` does not.** If some Obsidian version/path seeds `{}` instead of `""`, the bug would not reproduce — the exact brand-new content matters. `parseCanvas("{}")` → valid record; `ensureId` would write `metadata.frontmatter.id` via `writeId` (`CanvasDocIdStore.ts:86-92`).
3. **No content-change retry**: doc id assignment is only triggered by focus and manual backfill. Even after a fix, a canvas that was empty at first focus and edited *in place* (no leaf change) won't get re-processed until the next `active-leaf-change`.
4. **`console.error` noise**: every empty/new canvas focus logs `malformed canvas JSON` at error level (`CanvasDocIdStore.ts:68`), misleading for the normal "just created" case.
5. Both `DocIdFocusListener` and `VisitHistoryServiceV2` independently call `ensureDocId` (double work); harmless due to cached reads, but if a fix adds a write on empty content — ensure the atomic re-parse inside `process` (`CanvasDocIdStore.ts:35-44`) also handles empty content, or the write callback's `parseCanvas(content)` will again return `null` and skip the write.

## Open questions / ambiguities

1. **What exact bytes does the current Obsidian version write for a brand-new canvas** — truly empty `""`, or `{}`, or `{"nodes":[],"edges":[]}`? Test and bug report imply `""`; fix should handle all.
2. **Desired fix semantics**: should empty/whitespace canvas content be treated as `{}` and get an id written immediately on first focus (making a 0-byte file non-empty)? Confirm owner wants a write on first focus of an empty canvas.
3. **The locked-in test at `CanvasDocIdStore.test.ts:164-175` must be inverted** as part of the fix (currently encodes buggy behavior as expected).
4. Should there be a broader retry mechanism (modify/create event) so canvases created programmatically or synced in also get ids without needing focus? Related but likely out of scope.
