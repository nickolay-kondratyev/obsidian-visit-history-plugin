# sonar-005 — IMPLEMENTATION_REVIEWER PRIVATE memory

## Verdict: APPROVE (no changes requested)

## What was reviewed
Commit b252a6d "sonar-005: linear UserNameSafety validation (S8786)".
Change to `src/core/service/visitHistoryService/user/UserNameSafety.ts` +
`UserNameSafety.test.ts`. Readonly review — no source modified.

## Semantic-equivalence proof (old vs new)
Old: `/^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/`
- Branch A (len 2..200): first non-dot, middle any-charset, last non-dot.
- Branch B (len 1): single non-dot char.
- Union predicate P = { len 1..200 } ∧ { all chars in [a-z0-9._-] } ∧ { first char non-dot } ∧ { last char non-dot }.

New:
1. `len<1 || len>200` → false  ⇒ enforces len 1..200.
2. `startsWith('.') || endsWith('.')` → false ⇒ first non-dot ∧ last non-dot.
3. `/^[a-z0-9._-]+$/.test()` ⇒ all chars in charset ∧ len≥1.
New predicate = same P. IDENTICAL accept/reject set.

Case checks (all agree old==new):
- len 0 empty: reject/reject.
- len 1 `.`: reject (single dot). `_`,`-`,`0`,`a`: accept.
- len 200 all-`a`: accept. len 201: reject.
- leading dot `.john`: reject. trailing `john.`: reject. interior `a.b`: accept.
- uppercase `John`: reject (charset). space, `/`, `\`: reject (charset / not-dot but charset catches).
- non-ascii `jöhn`: reject (charset). `..`: reject (both boundaries dot; startsWith catches).
- Unicode/surrogate: not in charset → reject in both. `.length` vs regex both count UTF-16 code units; only matters for accepted strings which are all ASCII (1 unit) → no divergence.
- JS `$` semantics (no `m`/no trailing-newline match) identical in both regexes; `"a\n"` rejected by both (`\n` not in charset).

## Linearity / S8786
New `/^[a-z0-9._-]+$/`: single char class, single `+`, both-anchored. No nested/overlapping
quantifiers, no alternation across a split boundary → linear, no catastrophic/polynomial
backtracking. Satisfies S8786. Old had overlapping boundary classes around `{0,198}` → the
flagged pattern.

## sanitize `/\.+$/` (out of scope) — correctly left untouched
Not an overlapping-quantifier pattern; input pre-capped to ≤200 by `.slice(0,200)` → no runtime
risk. Comment on line 52 documents the ordering rationale. Justified.

## Code quality vs CLAUDE.md
- Explicit return type `: boolean` present.
- `DOT = '.'` const avoids magic literal; used in startsWith/endsWith and semantically distinct
  from charset regex. Fine (minor: could be seen as over-extraction but improves readability).
- WHY-comment accurate: explains split + why old regex backtracked.
- No scope creep. `MAX_USER_NAME_LENGTH` reused (already existed).
- Tests: added accept `_`,`-`,`0`,`a.b`,`-lead`,`lead-`; reject `.`,`..`. Good boundary pinning.

## Independent verification
- `npm test`: 37 files / 366 tests PASSED (exit 0). Log .tmp/rev-npm-test.txt.
- `npm run lint`: 0 errors, 2 pre-existing warnings (main.ts prefer-active-doc, unrelated). Log .tmp/rev-npm-lint.txt.

## Minor observations (non-blocking)
- Test suite does not include a max-length WITH interior dot at boundary (e.g. `a`.repeat(199)+`b`
  style) but existing cases already pin all distinct predicate dimensions; coverage adequate.
- No functional gaps found.
