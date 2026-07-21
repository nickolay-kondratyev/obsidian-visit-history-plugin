# sonar-005 — IMPLEMENTATION REVIEW (PUBLIC)

## Verdict: APPROVE

The fix for SonarQube `typescript:S8786` in `UserNameSafety.isValidUserName` is correct,
behavior-preserving, and genuinely linear. Tests and lint verified green independently.

## Semantic-equivalence analysis
Old regex `/^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/` accepts exactly:
`len ∈ 1..200` ∧ `all chars ∈ [a-z0-9._-]` ∧ `first char non-dot` ∧ `last char non-dot`
(single-char branch = the same predicate at len 1).

New implementation enforces the identical predicate via three independent checks:
1. `len<1 || len>200` → reject (len 1..200),
2. `startsWith('.') || endsWith('.')` → reject (first & last non-dot),
3. `/^[a-z0-9._-]+$/.test()` → all chars in charset, len ≥ 1.

Reasoned through every boundary: len 0/1/200/201, single `.`/`_`/`-`/`0`, interior dot `a.b`,
leading/trailing dot, `..`, uppercase, whitespace, `/`, `\`, non-ascii, surrogate/unicode, and
JS `$`/newline semantics — **no divergence found**. UTF-16 code-unit counting matches between
`.length` and the (non-`u`) regex, and only affects accepted strings which are all single-unit
ASCII, so length semantics are identical.

## Linearity (S8786)
`/^[a-z0-9._-]+$/` is a single character class with a single `+` quantifier, anchored at both
ends — no nested or overlapping quantifiers, no alternation splitting a repeated class. Linear,
no polynomial/catastrophic backtracking. This removes the overlapping-boundary construct that
S8786 flagged. Length and dot-boundary checks are plain O(1)/O(n) string ops.

## Findings
- **[nit]** `DOT = '.'` extraction is borderline over-abstraction for a one-char literal, but it
  reads well and keeps startsWith/endsWith self-documenting. No change needed.
- **[nit]** Test coverage adequately pins every predicate dimension; no additional case required.
- The out-of-scope `/\.+$/` in `sanitizeToValidOrNull` was correctly left untouched — it is not
  the overlapping-quantifier pattern and its input is pre-capped to ≤200 chars (`.slice(0,200)`),
  so there is no runtime risk. Ordering rationale is documented in a WHY comment. Justified.
- No CLAUDE.md violations: explicit return type present, WHY comment accurate, no scope creep,
  reuses existing `MAX_USER_NAME_LENGTH`, no anchor-point/test removal.

## Independent test & lint results
- `npm test`: **37 files / 366 tests PASSED** (exit 0). Log: `.tmp/rev-npm-test.txt`.
- `npm run lint`: **0 errors**, 2 pre-existing warnings in `main.ts` (`obsidianmd/prefer-active-doc`,
  unrelated to this change). Log: `.tmp/rev-npm-lint.txt`.

## Documentation updates needed
None. This is an internal validation refactor with no user-visible or architectural change; the
CLAUDE.md `UserNameSafety` description (lowercase charset, no leading/trailing dot) still holds.
