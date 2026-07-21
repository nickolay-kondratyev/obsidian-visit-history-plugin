# sonar-005 — IMPLEMENTATION PUBLIC

## Summary
Fixed SonarQube MAJOR `typescript:S8786` (regex super-linear backtracking) in
`src/core/service/visitHistoryService/user/UserNameSafety.ts`. Replaced the
overlapping-quantifier validation regex with explicit length + leading/trailing-dot
checks plus one non-overlapping single-quantifier charset regex. Behavior-preserving.

## Old vs new
Old (line 8):
```ts
const VALID_USER_NAME_PATTERN = /^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/;
static isValidUserName(u) { return VALID_USER_NAME_PATTERN.test(u); }
```
New:
```ts
const ALLOWED_CHARSET_PATTERN = /^[a-z0-9._-]+$/;   // single class, single quantifier — linear
const DOT = '.';
static isValidUserName(userName: string): boolean {
  if (userName.length < 1 || userName.length > MAX_USER_NAME_LENGTH) return false;
  if (userName.startsWith(DOT) || userName.endsWith(DOT)) return false;
  return ALLOWED_CHARSET_PATTERN.test(userName);
}
```
The middle `{0,198}` class overlapped the boundary `[a-z0-9_-]` classes, so near-miss
input backtracked polynomially (the S8786 pattern). The new charset regex has no
overlapping quantifiers; length and dot-boundary are plain string ops.

## Semantic-equivalence argument
Old regex accepts a string iff ALL hold: (1) length 1..200, (2) every char in
`[a-z0-9._-]`, (3) first and last char are non-dot (the `^[a-z0-9_-]$` alt covers the
single-char case, itself a non-dot char). Max length = 2 boundary + 198 middle = 200,
matching `MAX_USER_NAME_LENGTH`. The new code tests exactly those three conditions
independently, so the accepted/rejected sets are identical. Verified against all
existing tests plus added boundary tests.

## Out of scope (noted)
`/\.+$/` on the `sanitizeToValidOrNull` path is left UNCHANGED: not the
overlapping-quantifier issue the ticket describes, and its input is already capped to
≤200 chars by the preceding `.slice(0, 200)` — no runtime risk.

## Tests added
`UserNameSafety.test.ts` boundary cases (added BEFORE the fix, passed against the old
regex first, then confirmed green after):
- accept: `_`, `-`, `0` (single non-dot), `a.b` (interior dot), `-lead`, `lead-`
- reject: `.` (single dot), `..` (double dot)

## Results
- `npm test`: 37 files, 366 tests PASSED (exit 0)
- `npm run lint`: 0 ERRORS (2 pre-existing warnings in main.ts, unrelated) — PASS
- `npm run build`: PASS (tsc -noEmit + esbuild production, exit 0)
