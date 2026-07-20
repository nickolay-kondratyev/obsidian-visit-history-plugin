# IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — how-to-publish

## Goal
Publish-prep the plugin: metadata cleanup, publishing doc, helper scripts, CI fixes. First public release 1.0.0.

## Binding decisions (from CLARIFICATION)
- id → `visit-history`; name → `Visit History`; version → `1.0.0` everywhere.
- license (package.json) → `LicenseRef-KSAL-2.3`. Do NOT touch LICENSE.md text.
- description (manifest + package.json aligned) = "Records the visit history of notes and canvases, and visualizes vault activity as a treemap heatmap." (98 chars, ends period, no emoji).
- authorUrl/fundingUrl → https://glassthought.com. Keep minAppVersion 1.5.7, isDesktopOnly false.
- versions.json final = { "1.0.0": "1.5.7" } (tab indent).
- CI: submodules recursive in lint.yml + release.yml; SHA256SUMS asset in release.yml.

## Facts
- Old id only in manifest.json. Name "Visit History Plugin" in prose titles (README.md, docs/README.md, AGENTS.md) + README enable line (README.md:44, user-facing → fix to "Visit History").
- No scripts/ dir. shellcheck NOT installed → bash -n only.
- release.yml uses actions/attest@v4 (generic) + draft release; keep draft.
- gh v2.23.0 present, unauthenticated.

## Steps / status
1. [done-planning] manifest.json edits
2. package.json edits
3. versions.json edit
4. README enable line fix (visit-history display name)
5. scripts/release.sh + scripts/verify-release.sh (+chmod, bash -n)
6. lint.yml + release.yml CI edits (submodules recursive, SHA256SUMS)
7. docs/how-to-publish.md + docs/README.md row
8. build + lint + test (redirect to .tmp/); JSON validate; bash -n scripts
9. PUBLIC writeup

## STATUS: COMPLETE
All 9 steps done. build/lint/test PASS (358 tests). JSON valid. bash -n pass. PUBLIC written.
Changes left in working tree (uncommitted, as required).

## Notes
- No new unit-testable logic (config/docs/CI/shell) → no tests warranted (stated in PUBLIC).
- shellcheck NOT installed → bash -n only.
- Do NOT git commit (TOP_LEVEL handles it).
