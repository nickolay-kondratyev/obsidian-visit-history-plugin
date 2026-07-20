---
id: nid_v61ea73rmsqpcs4k0icrjhq7m_E
title: "Obsidian bot: no-unsafe-* warnings from missing submodule in review CI"
status: open
deps: []
links: []
created_iso: 2026-07-20T22:34:17Z
status_updated_iso: 2026-07-20T22:34:17Z
type: chore
priority: 3
assignee: CC_fable5_WITH-nickolaykondratyev
external-ref: obsidian-review-warnings
tags: [obsidian-review, ci, lint]
---

The Obsidian community-plugin review bot reported ~12 `@typescript-eslint/no-unsafe-call|member-access|assignment|return|argument` warnings across:
- src/core/focusTracker/listener/DocIdFocusListener.ts:22
- src/core/focusTracker/listener/VhV3FocusDurationListener.ts:28
- src/core/init/PluginFactory.ts:80
- src/core/service/docId/DocIdBackfillService.ts:53,69
- src/core/service/visitHistoryService/user/UserNameProvider.ts:32
- src/core/service/visitHistoryService/v3/VisitHistoryServiceV3.ts:23,28,33,36,42
- src/core/util/env/DeviceNameProvider.ts:37
- src/testSupport/fileFactory.ts:19-23

FINDING (see .ai_out/obsidian-review-warnings/fix-obsidian-warnings/EXPLORATION_PUBLIC.md): NONE reproduce locally. `npm run lint` at HEAD = 0 errors, and the local eslint config sets no-unsafe-* to ERROR (typescript-eslint recommendedTypeChecked), so if these were real `any` values local lint would hard-fail. Every site traces to a concrete TS type.

ROOT-CAUSE THEORY: obsidian-id-lib is a `file:` dep pointing at the git submodule submodules/obsidian-id-lib. The review bot likely checks out WITHOUT --recurse-submodules, so lib types fail to resolve and the bot falls back to implicit `any`, cascading no-unsafe-* across every docIdService.*/file.* call. This is a CI/packaging concern, NOT a source defect. Shipped main.js bundles the lib source via esbuild, so runtime is unaffected.

## Acceptance Criteria

Confirm against the bot's actual log whether submodule was checked out. If theory holds: no source change; document/ensure the review submission includes submodule sources (or vendor the lib). Do NOT add defensive casts/guards to the listed lines — they are already maximally type-safe and edits would be noise + risk.

