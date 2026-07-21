# sonar-005 — PRIVATE memory (IMPLEMENTATION_WITH_SELF_PLAN)

## Status: DONE (not committed — TOP_LEVEL_AGENT commits + closes ticket)

## What / Why
Fix S8786 (regex super-linear backtracking) in
`src/core/service/visitHistoryService/user/UserNameSafety.ts`.

Offending const (line 8): `VALID_USER_NAME_PATTERN = /^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/`.
Middle quantifier `[a-z0-9._-]{0,198}` overlaps the boundary classes → polynomial backtracking.

## Change (behavior-preserving)
Decomposed `isValidUserName` into explicit O(1)/O(n) checks + one non-overlapping
single-quantifier charset regex:
```ts
static isValidUserName(userName: string): boolean {
  if (userName.length < 1 || userName.length > MAX_USER_NAME_LENGTH) return false;
  if (userName.startsWith(DOT) || userName.endsWith(DOT)) return false;
  return ALLOWED_CHARSET_PATTERN.test(userName); // /^[a-z0-9._-]+$/
}
```
- Removed `VALID_USER_NAME_PATTERN`; added `ALLOWED_CHARSET_PATTERN = /^[a-z0-9._-]+$/` and `const DOT = '.'`.
- Updated the leading WHY comment to describe the split (charset regex linear; length + dot checks separate) and why old regex backtracked.
- `sanitizeToValidOrNull` untouched. `/\.+$/` on the sanitize path left as-is (out of scope: input capped ≤200, not overlapping-quantifier — noted in EXPLORATION).

## Semantic equivalence
Old regex accepts iff: len≥1, all chars in `[a-z0-9._-]`, first+last non-dot (single-char branch = same, since single non-dot char). New logic checks exactly those three conditions independently. Length cap 200 = `MAX_USER_NAME_LENGTH` (old: 2 boundary + 198 middle = 200 max; single branch = 1). Identical.

## Tests
Added boundary cases to `UserNameSafety.test.ts` BEFORE the fix; confirmed they pass against the OLD regex (30 tests green), then re-ran after fix (still 30 green). Added:
- accept: `_`, `-`, `0` (single non-dot), `a.b` (interior dot), `-lead`, `lead-` (dash not boundary-forbidden)
- reject: `.` (single dot), `..` (double dot)

## Results
- Targeted vitest: 30 passed
- `npm test`: 37 files, 366 tests passed (exit 0)
- `npm run lint`: 0 errors, 2 pre-existing warnings in main.ts (prefer-active-doc, unrelated)
- `npm run build`: exit 0 (tsc + esbuild)
Logs in `.tmp/` (npm-test.txt, npm-lint.txt, npm-build.txt, vitest-*.txt).

## Gotchas
- Lint requires ZERO errors (warnings OK); the 2 main.ts warnings predate this ticket.
