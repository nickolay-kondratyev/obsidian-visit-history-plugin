# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — how-to-publish

First-public-release prep (1.0.0): metadata cleanup, publishing guide, helper
scripts, CI fixes. Built on EXPLORE_REPO / RESEARCH_BESTPRACTICES /
RESEARCH_LICENSE / CLARIFICATION (do not re-read those here).

## Plan (executed)
1. Fix package metadata (manifest/package/versions.json).
2. Write `docs/how-to-publish.md` + link it from `docs/README.md`.
3. Add `scripts/release.sh` + `scripts/verify-release.sh`.
4. CI: submodule checkout in lint + release; SHA256SUMS asset in release.
5. Verify build/lint/test + JSON + `bash -n`.

## Files changed (1-line why)
- `manifest.json` — id→`visit-history`, name→`Visit History`, version→`1.0.0`, https URLs, refreshed description (100 chars, ends "."), kept minAppVersion 1.5.7 / isDesktopOnly false.
- `package.json` — version→`1.0.0`, license→`LicenseRef-KSAL-2.3` (SPDX-valid custom-license ref; LICENSE.md text untouched). Description already matched manifest's richer wording.
- `versions.json` — collapsed to `{ "1.0.0": "1.5.7" }` (dropped stray `1.0.0:1.0.0` + never-released `0.0.10`), tab indent preserved.
- `README.md` — "enable **Visit History**" (was "Visit History Plugin"; user-facing display-name string now matches manifest name).
- `.github/workflows/lint.yml` — `submodules: recursive` on checkout (obsidian-id-lib `file:` dep breaks `npm ci` otherwise).
- `.github/workflows/release.yml` — `submodules: recursive`; new steps: verify tag == manifest version, generate `SHA256SUMS`, attest it alongside main.js, and attach it in `gh release create`. Draft behavior kept.
- `scripts/release.sh` (new, +x) — bump (`patch|minor|major|x.y.z`), clean-tree + branch checks, `npm version --tag-version-prefix=` (no `v`), manifest/package version-agreement guard, push branch+tag; first-release path tags current commit when files already at target.
- `scripts/verify-release.sh` (new, +x) — download assets, `gh attestation verify`, `sha256sum -c`.
- `docs/how-to-publish.md` (new) — full guide (release model, automated + manual paths, verifiable builds, first-submission vs updates, manifest field rules, license note, checklist + first-release runbook).
- `docs/README.md` — table row linking the new doc.

## Key decisions
- License: `LicenseRef-KSAL-2.3` in package.json (SPDX way to name a custom license, keeps "KSAL-2.3" visible). LICENSE.md untouched. Community-list acceptance confirmed OK (Smart Connections precedent, RESEARCH_LICENSE).
- Description (manifest == package.json): "Records the visit history of notes and canvases, and visualizes vault activity as a treemap heatmap." (100 chars, ends ".", no emoji).
- `release.sh` uses `--tag-version-prefix=` so npm tags `1.0.0` not `v1.0.0`; release.yml still guards tag==manifest as a backstop.
- First-release ergonomics: since files are already at 1.0.0, `release.sh 1.0.0` tags the current commit instead of `npm version` (which errors on unchanged version).

## Old-id/name grep result
- Old id `vintrin-visit-history-plugin` existed ONLY in `manifest.json` (fixed). No source/TS/mjs references — no migration code needed. Data dir consequence noted in the doc (`.obsidian/plugins/visit-history/`).
- Old name "Visit History Plugin" remains as prose H1 titles in `README.md`, `docs/README.md`, `AGENTS.md`. Left as-is (branding headings, not functional); only the user-facing "enable" instruction was corrected. See callout below.

## Tests
- No new unit-testable logic was introduced — all changes are config/JSON/docs/CI/bash. Per CLAUDE.md, no vitest tests were fabricated. Existing suite re-run as regression: **358 tests / 37 files pass**.
- Scripts syntax-checked with `bash -n` (both pass). `shellcheck` not installed in this env — could not run it (flagged).

## Verification results
- `npm run build` PASS · `npm run lint` PASS (0 errors, 2 pre-existing warnings, unrelated — no TS touched) · `npm test` PASS (358).
- `jq empty` on manifest/package/versions — all valid JSON.
- `bash -n` on both scripts — pass. `chmod +x` applied.

## Reviewer, scrutinize
- `release.yml` YAML: the two conditional `${{ ... && 'styles.css' || '' }}` expansions in `subject-path` and `gh release create` (pre-existing pattern, kept) — confirm they behave when styles.css exists (it does here, tracked).
- `release.sh` first-release branch (arg == current version) tags without `npm version` — confirm that matches how you want the very first 1.0.0 cut.
- Since gh is unauthenticated in this env, neither script was executed end-to-end (would push/hit GitHub). Syntax-only verified.

## Open callouts (non-blocking)
- H1 title "Visit History Plugin" in README.md / docs/README.md / AGENTS.md left unchanged (branding). Rename to "Visit History" if you want strict consistency with the manifest name.
- `README_ORIGINAL.md` (sample boilerplate) still present and now superseded by docs/how-to-publish.md. Consider deleting (deferred — owner call, not done).
- No CHANGELOG exists; release.yml uses `--draft` + you publish manually, and the manual path uses `--generate-notes`. Fine for 80/20; add a CHANGELOG later if desired.
