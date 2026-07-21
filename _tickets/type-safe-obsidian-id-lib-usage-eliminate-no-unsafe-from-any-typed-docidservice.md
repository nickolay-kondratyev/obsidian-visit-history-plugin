---
id: nid_g5c1rafp9gkv2ege8bmnjcxgq_E
title: "Type-safe obsidian-id-lib usage (eliminate no-unsafe-* from any-typed DocIdService)"
status: open
deps: []
links: []
created_iso: 2026-07-21T01:05:14Z
status_updated_iso: 2026-07-21T01:05:14Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [lint, typescript, type-safety, id-lib]
---

Obsidian plugin-review / strict type-aware lint reports a cluster of @typescript-eslint no-unsafe-* violations. ROOT CAUSE (verified): the DI symbols imported from `obsidian-id-lib` (`DocIdService`, `DocIdServices`) resolve to `any` under type-aware ESLint, so every `.getDocId()/.ensureDocId()/.isEligible()/DocIdServices.createDefault()` call, member access, assignment, argument, and return is flagged unsafe. Why they are `any`: `eslint.config.mts` ignores `submodules` (line ~26) and `tsconfig.json` only `include`s `src/**/*.ts`, so the submodule `submodules/obsidian-id-lib` (bundled via `file:` dep, `types: src/index.ts`) is NOT part of the type graph the linter sees.

FINDINGS COVERED (all same root cause):
- src/core/focusTracker/listener/DocIdFocusListener.ts:22 (no-unsafe-call, no-unsafe-member-access)
- src/core/focusTracker/listener/VhV3FocusDurationListener.ts:28 (no-unsafe-call, -member-access, -assignment)
- src/core/init/PluginFactory.ts:88 (no-unsafe-call, -member-access, -assignment)
- src/core/service/docId/DocIdBackfillService.ts:53 and :69 (no-unsafe-call, -member-access)
- src/core/service/visitHistoryService/v3/VisitHistoryServiceV3.ts:23,28,33,36,42 (no-unsafe-call, -member-access, -assignment, -argument)
- The unattributed "no-unsafe-return / Returns unsafe values from typed code" finding almost certainly belongs to this cluster too — verify after fixing.

FIX DIRECTION (pick the robust, maintainable one; keep submodule as source of truth): make the linter/compiler see real types for obsidian-id-lib — e.g. bring the submodule TS into the type-aware project (add a dedicated tsconfig for the submodule referenced by eslint `projectService`, or add a build step emitting `.d.ts` that the `file:` dep points at). Do NOT paper over with `as`/`eslint-disable` in each consumer. START with `npm run lint` to reproduce, confirm the finding set, fix the root cause, then re-run `npm run lint` and `npm run build` + `npm test` to prove zero remaining no-unsafe-* in these files. See CLAUDE.md "obsidian-id-lib" notes (bundled submodule).

## Acceptance Criteria

npm run lint reports zero @typescript-eslint/no-unsafe-* in the 5 listed source files; consumers stay free of per-call as/eslint-disable; npm run build + npm test green; npm run test:lib green if the submodule changed.

