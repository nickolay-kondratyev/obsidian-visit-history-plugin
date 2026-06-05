# F7: Unit Tests for Pure Functions

> **Priority:** Medium (quality)
> **Effort:** Medium (~1–2 hrs including test setup)
> **Depends on:** Phase 2 (constants & utils done)

## Scope

The pure functions in `src/view/utils.ts` are the most testable pieces in the codebase — no React, no DOM, no Obsidian:

| Function | What to test |
|----------|-------------|
| `heatColor()` | null ts → nil color; daysOld ≤ hotDays → hot color; daysOld ≥ coldDays → cold color; in between → interpolated |
| `leafFill()` | heatmap mode with/without hover; type mode with/without hover; unknown type fallback |
| `leafOpacity()` | heatmap with null ts → 0.55; heatmap with ts → 0.88; type mode → 0.78; hovered → 1 |
| `fmtBytes()` | 0 B, 512 B, 1.5 KB, 2.3 MB |
| `fmtDate()` | null → null; today; yesterday; N days ago |

## Test Setup

Option A: Use Obsidian's testing setup if one exists.
Option B: Add Jest or Vitest as devDependency.

Recommend Vitest — fast, ESM-native, compatible with the existing esbuild setup:

```bash
npm install --save-dev vitest
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

## Test File

`src/view/__tests__/utils.test.ts`

No need to test React components initially — the pure functions give the highest ROI for test coverage.

## Stretch

- Test `buildVaultTree()` with mock vault data
- Test `classifyFile()` logic for `.excalidraw.md` naming convention
