# F2: Fix Pre-Existing TypeScript Compilation Errors

> **Priority:** High
> **Effort:** Small (~15 min)
> **Depends on:** nothing (independent)

## Problem

`npm run build` runs `tsc -noEmit -skipLibCheck` before esbuild. This step fails due to broken imports in `src/core/focusTracker/` and `src/core/service/`:

```
src/core/focusTracker/data/FocusFile.ts(2,30): error TS2307:
  Cannot find module '../../core/util/file/note/NoteFileUtil'
```

The import path `../../core/util/...` from `src/core/focusTracker/data/FocusFile.ts` resolves to `src/core/core/util/...` (double `core/`). Correct path is `../../util/...`.

Also:
- `VHFileProvider.ts` — same double-core issue + implicit `any` on `bl` parameters
- `VisitHistoryService.ts` — same double-core issue

## Solution

Fix the relative import paths:

| File | Wrong import | Fixed |
|------|-------------|-------|
| `src/core/focusTracker/data/FocusFile.ts` | `../../core/util/...` | `../../util/...` |
| `src/core/focusTracker/listener/VHFileProvider.ts` | `../../core/util/...` | `../../util/...` |
| `src/core/service/visitHistoryService/VisitHistoryService.ts` | `../../core/util/...` | `../../util/...` |

Also add explicit types for the `bl` parameters in VHFileProvider.ts (the `.filter()` and `.map()` callbacks).

## Verification

Run `npm run build` — should succeed with no tsc errors.
