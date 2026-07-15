# IMPLEMENTATION_ITERATION — Heatmap Filter UI (4 MINOR findings)

> Role: IMPLEMENTATION (iteration). Dispositioned the 4 MINOR findings from
> `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict was already APPROVED).
> Commit: `af11371` on branch `heatmap-filter-ui`.

## Per-finding disposition

| # | Finding | Disposition | What / where |
|---|---|---|---|
| 1 | IME Enter commits partial terms | **FIXED** | `src/view/components/header/FilterPopover.tsx`: `onKeyDown` now requires `e.key === 'Enter' && !e.nativeEvent.isComposing` (+ WHY comment). React-only event guard — no unit test (no React harness; ticketed `react-component-test-harness.md`), consistent with the rest of the popover behavior being manual-verify. |
| 2 | DRY: trim/dedupe rule stated twice (FilterTermOps.add vs sanitizer) | **FIXED** | `HeatmapConfigSanitizer.sanitizeFilterTerms` (`src/viewModel/heatmapConfig.ts`) now only shape-validates (known kind + string text) and FOLDS entries through `FilterTermOps.add` — the rule (trim, non-empty, per-kind ci-dedupe first-wins) now exists ONCE. Runtime import cycle avoided by making `FilterTermOps`'s import from `heatmapConfig` `import type` (types erase; only heatmapConfig → FilterTermOps exists at runtime — commented in code). All 8 pre-existing sanitizer filter-term tests pass unchanged, proving behavior equivalence. |
| 3 | NUL comment invariant not enforced at data.json boundary | **FIXED** (enforced, not softened) | `FILTER_TERM_KEY_SEP = '\u0000'` moved to `src/viewModel/FilterTermOps.ts` (exported, documented as the reserved key-encoding separator); `FilterTermOps.add` REJECTS text containing it (same-reference no-op). Because the sanitizer now delegates to `add` (finding 2), the ban holds for hand-edited data.json too — App.tsx's joined effect key always splits back losslessly. `App.tsx` local `CONTENT_TERMS_KEY_SEP` const + now-false comment deleted; imports the shared constant. Chose one-condition enforcement over comment-softening: post-finding-2 there is a single normalization point, so enforcement cost ≈ comment cost. Deliberately banned ONLY the separator char, not all control chars — a general strip would be scope creep with no invariant behind it. |
| 4 | Field button missing `.active` open-state class | **FIXED** | `src/view/components/Header.tsx`: field button className gets `' active'` when `openPanel === 'field'`. Note the review's premise was slightly off — `.header-btn` had NO `.active` recipe (only `:hover`), so `styles.css` extends the hover rule to `.header-btn:hover, .header-btn.active` (same treatment as `.hdr-icon-btn`). |

Nothing was rejected — all four were technically valid and each fix stayed
minimal (findings 2+3 solved at one shared point).

## Tests added (+2)

- `FilterTermOps.test.ts`: `add` returns the SAME reference when text contains
  the reserved key separator.
- `heatmapConfig.test.ts`: sanitizer drops a hand-edited term containing the
  separator (keeps well-formed siblings). Tests build the string FROM the
  imported constant — no raw NUL escapes in test sources (tooling turns typed
  `\u0000` escapes into literal NUL bytes; the one occurrence in
  `FilterTermOps.ts` was byte-verified: `grep -rlP '\x00' src/` finds nothing).

## Verification (all run via /usr/local/bin/npm; logs in .tmp/iter-*.log)

| Gate | Result |
|---|---|
| `npm test` | **335 passed / 0 failed** (39 files; was 333 — +2 new, none removed) |
| `npm run lint` | **0 errors** (2 pre-existing `main.ts` `obsidianmd/prefer-active-doc` warnings, untouched) |
| `npm run build` | clean (`tsc -noEmit` + esbuild production) |

## Readiness

**READY TO MERGE.** All review findings dispositioned (4/4 fixed), gates
green, single commit `af11371`, no open questions.
