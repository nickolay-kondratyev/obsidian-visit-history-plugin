# CLARIFICATION — RESOLVED (Human-aligned)

Task: Brand-new canvas gets no doc id → no visit history recorded.

## Decisions (approved by HUMAN 2026-07-15)

1. **Fix semantics**: Treat empty/whitespace-only canvas content as `{}`. On first focus, write
   `{"metadata":{"frontmatter":{"id":"docid_..._E"}}}` into the file and record the visit.
   - Truly malformed (non-empty, unparseable) canvas JSON keeps current behavior: skip with
     `console.error`, never overwrite user data.
2. **Test inversion approved**: `CanvasDocIdStore.test.ts:164-175` (empty canvas → null, no write)
   is to be ADJUSTED to the new behavior (empty canvas → id written).
3. **Scope**: retry-on-modify mechanism (canvases synced in / edited while focused) is OUT of scope.
   Follow-up ticket if desired.

## Key constraint from exploration

The write path (`CanvasDocIdStore.ensureId` → `Vault.process` callback) re-parses content inside the
atomic write; that re-parse MUST also treat empty content as `{}`, or the write silently no-ops
(see EXPLORATION_PUBLIC.md, Secondary issue #5).
