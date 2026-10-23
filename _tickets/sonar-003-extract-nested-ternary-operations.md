---
id: nid_8almx8w2vqgtktv9p1yajmny4_E
title: "sonar-003: Extract nested ternary operations"
status: old
deps: []
links: []
created_iso: 2026-07-20T23:33:37Z
status_updated_iso: 2026-10-23T15:56:57Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [sonar]
---

Fix SonarQube MAJOR rule S3358 (extract nested ternary into an independent statement) for readability.

TypeScript (typescript:S3358):
- src/testSupport/FakeHiddenFileUtil.ts:53
- src/view/components/TreemapViz.tsx:175
- src/view/utils.ts:83

JavaScript prototype (javascript:S3358):
- raw_proto/visit_visualization/vault-treemap.html:326, :692

Note: vault-treemap.html is a raw prototype — confirm with owner whether raw_proto is worth touching or should be excluded from Sonar scope instead of edited.

Acceptance: replace each nested ternary with a clear intermediate variable / if-else; behavior unchanged; npm test green for the TS files.

Sonar keys: AZ9NwQFufbPghhCaeg9t, AZ6VQaSkkQYuylDfZBSE, AZ6VQaPHkQYuylDfZBR3, AZ6VAUFs2Ak3xlgm7zHY, AZ6VAUFs2Ak3xlgm7zHd


## Notes

**2026-10-23T15:56:57Z**

Marked old (2026-10-23 ticket triage): TS findings already resolved — AST scan finds no nested ternaries in the 3 listed TS files; only raw_proto/ (throwaway prototype) remains, not worth touching.
