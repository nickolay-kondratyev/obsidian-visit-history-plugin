# TOP_LEVEL_AGENT — how-to-publish (change log entry)

Branch: `how-to-publish`. Feature: research-backed publishing guide + first-release (1.0.0) package prep.

## Flow executed
EXPLORE (repo + best-practices + license-acceptance research) → CLARIFICATION (human) → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW (verdict READY, 1 should-fix) → IMPLEMENTATION_ITERATION (S1 fixed, nice-to-haves adjudicated) → converged.

## Change log entry (single entry for the whole flow)
**how-to-publish: 1.0.0 release prep — verifiable publishing guide, helper scripts, metadata + CI cleanup.**
- New `docs/how-to-publish.md`: release model (tag == manifest version, no `v` prefix; individual assets, never zipped), automated (tag-triggered Actions) + manual `gh` paths, provenance attestation + SHA256SUMS verification, first-submission-to-community-list vs update, manifest field rules, KSAL-2.3 license note (Smart Connections precedent). Linked from `docs/README.md`.
- New `scripts/release.sh` (clean-tree + build/test gate → `npm version --tag-version-prefix=` → push branch+tag, triggering `release.yml`) and `scripts/verify-release.sh` (verify main.js + SHA256SUMS attestations, then `sha256sum -c`).
- Metadata aligned to Obsidian best practices + bumped to 1.0.0: `manifest.json` (id `visit-history`, name `Visit History`, https URLs, ≤250-char description ending in a period), `package.json` (v1.0.0, license `LicenseRef-KSAL-2.3`), `versions.json` `{ "1.0.0": "1.5.7" }` (stray/unreleased entries removed). LICENSE.md text untouched.
- CI: `submodules: recursive` checkout in `lint.yml` + `release.yml`; `release.yml` now guards tag==manifest, generates + attests + attaches `SHA256SUMS` (draft-release behavior kept).

## Commits
- `c94cf9a` — implementation.
- iteration commit — S1 (verify SHA256SUMS attestation) + N1 (pre-tag build/test gate).

## Callouts (for human)
See final console output table.
