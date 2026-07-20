# EXPLORATION_PUBLIC — how-to-publish

Two source docs (read these for detail; do not duplicate):
- `EXPLORE_REPO__PUBLIC.md` — current repo/release state (manifest, versions.json, package.json, workflows, docs, git, gh).
- `RESEARCH_BESTPRACTICES__PUBLIC.md` — Obsidian publishing best practices (release mechanics, manifest rules, submission vs update, verifiable builds/attestation, `gh` CLI, version bump).

## Task recap
Create `docs/how-to-publish.md` (research-backed best practices), lean on CLI (`gh`) for asset creation, add helper script(s) to ease publishing, prepare the package for publishing (naming aligned to Obsidian best practices), and bump the version throughout.

## Most decision-relevant facts
1. **Release pipeline ALREADY exists** — `.github/workflows/release.yml` (tag push → build → `actions/attest@v4` provenance → DRAFT `gh release create` with main.js/manifest.json/styles.css). Never used (no tags, still 0.0.10). So this is doc + polish + first-release prep, not from-scratch CI.
2. **Naming violates Obsidian rules** (RESEARCH): `id` must be lowercase `[a-z0-9-]`, must NOT contain "obsidian" nor end with "plugin"; `name` must NOT contain "Obsidian"/"Plugin".
   - current `id` = `vintrin-visit-history-plugin` (ends in "plugin" → invalid).
   - current `name` = "Visit History Plugin" (contains "Plugin" → invalid).
   - Safe to change now — nothing released yet.
3. **License mismatch / submission risk**: package.json `"license":"0-BSD"` contradicts `LICENSE.md` (custom KSAL-2.3, source-available, non-OSS, commercial restriction). Obsidian community list generally expects free/permissive; likely a submission friction point.
4. **versions.json** has a stray `"1.0.0":"1.0.0"` entry (no matching tag/version).
5. **description drift**: manifest shorter than package.json; must be ≤250 chars, end with a period, no emoji, and byte-match across manifest and the submission PR.
6. **http URLs**: authorUrl/fundingUrl are `http://glassthought.com` (prefer https).
7. **gh**: installed (v2.23.0, old) but NOT authenticated here → scripts must note `gh auth login`/`GH_TOKEN` prereq.
8. **CI gap**: neither workflow checks out the `obsidian-id-lib` submodule (`file:` dep) — `npm ci` may fail.
9. **Submission model**: first time = one PR to `obsidianmd/obsidian-releases`; every later version = just push a new GitHub release.
10. **Verifiable builds 80/20**: `actions/attest-build-provenance` (keyless Sigstore, SLSA L2) verified via `gh attestation verify main.js --repo owner/repo`; add-ons = attached `SHA256SUMS` + signed git tags. Attestation only works on GitHub runners, not laptop builds.

## Open decisions for HUMAN (see clarification round)
- New `id` value; new `name` value.
- Version bump target (0.0.11 vs 1.0.0) + remove stray versions.json entry.
- License: fix package.json to match LICENSE.md + document risk (vs other).
- Whether to also polish `release.yml` (SHA256SUMS + submodule checkout) or doc-only.
