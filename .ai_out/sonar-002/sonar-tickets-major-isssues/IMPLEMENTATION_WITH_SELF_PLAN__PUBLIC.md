# sonar-002 (typescript:S9011) — Explicit button type — DONE

Added `type="button"` to all 8 `<button>` elements across the 3 flagged files.
Every button is a click handler; none submits a form, so `type="button"` matches
the intended (non-submit) semantics — no behavior change.

## Buttons changed (all `type="button"` added)
- src/view/components/Header.tsx
  - breadcrumb "← back" button (was ~L51)
  - "field:" toggle button (was ~L66)
  - reset-zoom icon button (was ~L76)
  - "info" toggle icon button (was ~L84)
  - "config" toggle icon button (was ~L93)
- src/view/components/TreemapViz.tsx
  - "clear filters" empty-state button (was ~L331)
- src/view/components/header/FilterGroup.tsx
  - filter toggle icon button (was ~L27)
  - filter-chip remove (X) button (was ~L48)

## Buttons intentionally left
- None. All 8 flagged buttons handled; no `<button>` without an explicit type
  remains in the three files.

## Verification
- `npm run lint`: exit 0 — 0 errors, 2 warnings.
  - Both warnings are PRE-EXISTING and unrelated: src/main.ts:133 & :137
    obsidianmd/prefer-active-doc (use `activeDocument` instead of `document`).
    Not touched by this change.
- `npm test`: exit 0 — 37 test files passed, 358 tests passed.
