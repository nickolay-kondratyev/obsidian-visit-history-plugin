# Retry doc-id assignment on file modify

**Status**: OPEN (follow-up from `new-canvas-docid` fix, 2026-07-15)

## Context
Doc-id assignment triggers only on (a) focus events (`active-leaf-change`) and (b) manual
backfill from the settings tab. A canvas/note that is synced in, created programmatically,
or edited **while staying focused** gets no id until the next leaf change.

The empty-new-canvas case was fixed (`CanvasDocIdStore` treats empty/whitespace content as `{}`),
so this is now a narrow gap, explicitly scoped OUT by owner during that fix.

## Possible approach
Listen to `vault.on('modify')` (debounced) and run `ensureDocId` for tracked files missing an id.
Weigh write-amplification and event-noise before implementing.
