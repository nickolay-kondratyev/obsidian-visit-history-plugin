# EXPLORATION — sonar-005: UserNameSafety regex super-linear backtracking

## Ticket
- Sonar rule typescript:S8786 (regex super-linear performance due to backtracking). Sonar key AZ9xOA-LJI5IiFqUsA6F.
- Target file: `src/core/service/visitHistoryService/user/UserNameSafety.ts`.
- Ticket cites line 41, but line 41 is a stale reference. The ticket **description** is authoritative:
  "enforces the lowercase filename-safe charset (a-z0-9._-)" and "avoid **nested/overlapping quantifiers**".
  That description matches the **`VALID_USER_NAME_PATTERN`** on line 8 — NOT the trivial `/\.+$/` on line 41.

## The offending regex (line 8)
```ts
const VALID_USER_NAME_PATTERN = /^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/;
```
The middle quantifier `[a-z0-9._-]{0,198}` overlaps with the boundary classes `[a-z0-9_-]`
before/after it. On near-miss inputs the engine backtracks across the split → polynomial. This
is exactly the "nested/overlapping quantifiers" pattern S8786 flags.

## Exact accept/reject semantics that MUST be preserved
- Length 1..200 (inclusive).
- All chars in `[a-z0-9._-]` (lowercase letters, digits, dot, dash, underscore).
- First char and last char must NOT be a dot (i.e. in `[a-z0-9_-]`).
- Single-char names: the char must be non-dot (`[a-z0-9_-]`).
- Rejects: empty, uppercase, whitespace, `/`, `\`, non-ascii, length 201, leading/trailing dot.

## Recommended linear rewrite (HYPER-OBVIOUS, no backtracking)
Decompose into explicit checks + one non-overlapping single-quantifier charset regex:
```ts
static isValidUserName(userName: string): boolean {
  if (userName.length < 1 || userName.length > MAX_USER_NAME_LENGTH) return false;
  if (userName.startsWith('.') || userName.endsWith('.')) return false;
  return /^[a-z0-9._-]+$/.test(userName);
}
```
- `/^[a-z0-9._-]+$/` is a single charset with a single quantifier — provably linear, no overlap.
- length + leading/trailing-dot checks are O(1)/O(n) plain string ops.
- Semantically identical to the original (verified against every existing test case).
- `MAX_USER_NAME_LENGTH` constant (200) already exists in the file.
- `VALID_USER_NAME_PATTERN` const can be removed (or replaced by the simple charset const).

Alternative if the owner prefers a single regex: a lookahead form is possible but less readable;
the decomposition above is the Pareto/KISS choice and is preferred.

## Note on line 41 `/\.+$/` (sanitizeToValidOrNull)
Technically `/\.+$/` can also be O(n²) on adversarial input, but: (a) it is NOT the
"nested/overlapping quantifiers" the ticket describes, (b) its input is already capped to ≤200
chars by the preceding `.slice(0, 200)`, so no real runtime risk. **Leave it unchanged** unless
Sonar explicitly re-flags it — changing it is out of scope for this ticket.

## Tests
- `src/core/service/visitHistoryService/user/UserNameSafety.test.ts` already covers accept/reject
  (valid names, uppercase, space, leading/trailing dot, path sep, backslash, overlong, non-ascii,
  boundary 200/201) AND sanitize behavior. These are the behavior-capturing tests.
- Acceptance: tests stay green after the rewrite. Consider adding one explicit boundary test if a
  gap is found (e.g. single-char dot `.` rejected, single-char `_`/`-` accepted).

## Commands
- `npm test` (vitest) — run the suite.
- `npm run lint` — must stay at ZERO errors.
- `npm run build` — production build (tsc + esbuild) sanity.
