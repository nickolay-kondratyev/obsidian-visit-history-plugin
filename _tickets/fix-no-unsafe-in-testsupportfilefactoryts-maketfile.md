---
id: nid_5fsaf5dezp7c461ch78la79m2_E
title: "Fix no-unsafe-* in testSupport/fileFactory.ts (makeTFile)"
status: open
deps: []
links: []
created_iso: 2026-07-21T01:06:01Z
status_updated_iso: 2026-07-21T01:06:01Z
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

