---
closed_iso: 2026-07-21T01:42:15Z
id: nid_5fsaf5dezp7c461ch78la79m2_E
title: "Fix no-unsafe-* in testSupport/fileFactory.ts (makeTFile)"
status: closed
deps: []
links: []
created_iso: 2026-07-21T01:06:01Z
status_updated_iso: 2026-07-21T01:42:15Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, typescript, test-support, type-safety]
---

src/testSupport/fileFactory.ts (the `makeTFile` test helper) triggers @typescript-eslint/no-unsafe-call / -member-access / -assignment on lines 19-23 (the `spec.path.split(...).at(-1)` + `file.name/basename/extension` assignments around the `new TFile()` instance). This is TEST-SUPPORT only, isolated to this one file. Root cause is the loosely/any-typed TFile stand-in interplay at test-build time.

FIX DIRECTION: make the helper strictly typed without lying — annotate/narrow so the string ops and TFile field assignments are type-checked, no `any` leakage, no blanket eslint-disable. Keep the documented behavior in the file header (obsidian resolves to obsidianMock.ts at test runtime; instanceof TFile must still hold). Do NOT change the produced TFile shape used by existing tests.

VERIFY: `npm run lint` clean for src/testSupport/fileFactory.ts; `npm test` green (all consumers of makeTFile still pass).

## Acceptance Criteria

Zero no-unsafe-* in src/testSupport/fileFactory.ts; makeTFile output shape unchanged; npm run lint + npm test green.


## Notes

**2026-07-21T01:42:15Z**

RESOLUTION: Already satisfied at HEAD (6d8a745) — no code change warranted.

Investigation:
- src/testSupport/fileFactory.ts is byte-identical on master and this branch and
  lints CLEAN: `npm run lint` -> 0 errors (only 2 unrelated prefer-active-doc
  warnings elsewhere). Zero @typescript-eslint/no-unsafe-* on lines 19-23 or anywhere.
- Verified the no-unsafe-* rules are genuinely ACTIVE and type-aware for src/ (not a
  false negative): a probe file `const a: any = {}; a.foo.bar()` placed under src/
  fires no-unsafe-assignment/-call/-member-access exactly. The helper produces none.
- Root cause of the original report: `TFile` from the installed `obsidian` package
  resolves to a fully-typed class, so `new TFile()`, `spec.path.split('/').at(-1)`
  (string[] -> string|undefined, guarded by `?? spec.path`), and the field
  assignments are all type-checked/safe. The ticket's unsafe errors only occur when
  `obsidian` types are unresolved (TFile => any) — i.e. before `npm install`
  (a documented required dev-env step). Once deps are installed, it is clean.
- `npm test` green: 38 files / 381 tests passed. makeTFile shape unchanged (untouched).

Acceptance criteria (zero no-unsafe-*, shape unchanged, lint+test green) all MET.
Closing as already-resolved; no commit made (fabricating a diff to a clean file
would be churn/dishonest).
