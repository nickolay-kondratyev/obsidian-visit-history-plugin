# Heatmap filter: exclusion/negation terms

**Status**: OPEN (deferred from `heatmap-filter-ui`, 2026-07-15)

## Problem
The heatmap filter is include-only OR (HUMAN-approved v1 scope). Users cannot
express "everything EXCEPT drafts" or combine terms with AND.

## Fix ideas
- Add a per-term `negate` flag (or `-term` input syntax) to `FilterTerm`;
  `filterVaultTree` predicate becomes `(anyInclude || noIncludesExist) && !anyExclude`.
- Chips would need a third visual treatment (e.g. strikethrough/red tint + glyph).
- Sanitizer/FilterTermOps extend naturally (kind stays `path|content`).
