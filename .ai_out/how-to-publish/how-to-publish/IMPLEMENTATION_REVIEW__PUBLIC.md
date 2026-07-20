# IMPLEMENTATION_REVIEW__PUBLIC — how-to-publish (commit c94cf9a)

**Verdict: READY.** No BLOCKING findings. 1 SHOULD-FIX, 3 NICE-TO-HAVE.

Reviewed the release-prep landing against CLARIFICATION, RESEARCH_BESTPRACTICES,
RESEARCH_LICENSE. Metadata, guide, scripts, and CI are technically correct and
internally consistent.

## Verified correct (the high-risk checks)

- **`v`-prefix tag risk — HANDLED.** `scripts/release.sh:54` runs
  `npm version "$BUMP" --tag-version-prefix=` (empty prefix) → npm tags `1.0.0`,
  not `v1.0.0`. First-release path (`:47-49`) tags the current commit directly
  when files are already at target. release.yml also guards `tag == manifest`
  (`:36-43`). Obsidian's no-`v` rule is satisfied on every path.
- **Attestation action — CORRECT (surprising but verified).** release.yml uses
  `actions/attest@v4` (pre-existing in the repo, not introduced here) with only
  `subject-path`. Verified against upstream: `actions/attest` (v4.2.0 latest,
  2026-07) **defaults to SLSA build-provenance** mode when no `predicate-type`
  is given, so it produces the same build-provenance attestation that
  `gh attestation verify` (verify-release.sh:35, doc:98) consumes. Not a bug.
- **release.yml SHA256SUMS + guard logic — CORRECT.** Checksums generated over
  `main.js manifest.json` (+`styles.css` when present) BEFORE attest; SHA256SUMS
  is attested and attached; tag==manifest guard exits non-zero on mismatch;
  `--draft` preserved. Conditional `${{ … && 'styles.css' || '' }}` expansions
  behave (styles.css is tracked here).
- **Metadata — EXACTLY as decided.** manifest.version == package.version ==
  `1.0.0`; id `visit-history` (lowercase, no "obsidian", no trailing "plugin");
  name `Visit History` (no "Obsidian"/"Plugin", no emoji); description 100 chars,
  ends with ".", no emoji, identical in manifest+package; https author/funding
  URLs; `versions.json` == `{ "1.0.0": "1.5.7" }`; license
  `LicenseRef-KSAL-2.3` (valid SPDX LicenseRef). All three JSON files parse.
- **submodule fix — present** on checkout in both lint.yml and release.yml
  (`submodules: recursive`).
- **License positioning — matches RESEARCH_LICENSE.** Smart Connections
  precedent, "no license-type requirement", LICENSE.md exists at root and is
  linked. Accurate.
- **Doc facts — match RESEARCH.** tag==version no-`v`; individual (non-zipped)
  assets; first-PR-to-obsidian-releases vs no-second-PR update model;
  byte-for-byte id/name/description match; manifest field rules; attestation +
  `sha256sum -c` commands copy-pasteable. Links resolve (`../scripts/*`,
  `../.github/workflows/release.yml`, `../LICENSE.md`, `../README.md#license`
  → `### License` anchor exists; docs/README row added). Scripts are `+x`
  (100755) and pass `bash -n`.

## SHOULD-FIX

### S1 — verify-release.sh does not attestation-verify SHA256SUMS, weakening the guarantee for manifest.json / styles.css
`scripts/verify-release.sh:35,40` runs `gh attestation verify main.js` then
`sha256sum -c SHA256SUMS`. main.js provenance is proven directly. But
manifest.json and styles.css are only checked *against SHA256SUMS* — and
SHA256SUMS's own authenticity is never attestation-verified in the script, even
though the workflow DOES attest it (release.yml:51-57). A release that tampered
with both manifest.json and SHA256SUMS would pass `sha256sum -c` and never be
caught by this helper. Since verifiable provenance is the stated purpose, close
the loop:

```bash
gh attestation verify SHA256SUMS --repo "$REPO"   # add before sha256sum -c
```

Low-cost, one line; makes the checksum chain trustworthy end-to-end. Not
blocking (main.js — the executable code — is already fully protected).

## NICE-TO-HAVE

- **N1 — release.sh tags without running build/lint/test.** It relies on CI to
  catch a broken build after the tag is already pushed. The doc checklist and
  runbook tell the human to run them first, so this is acceptable 80/20, but a
  cheap `npm run build && npm test` gate before tagging would avoid a bad tag on
  the remote. (`scripts/release.sh`, before line 54/67.)
- **N2 — re-running release.sh for an already-pushed version fails noisily.**
  `git push origin refs/tags/$NEW_VERSION` (`:72`) errors if the tag already
  exists on the remote. Fine for the normal flow; just be aware re-cutting the
  same version needs a manual tag delete first.
- **N3 — stale "Visit History Plugin" H1 branding** remains in README.md /
  docs/README.md / AGENTS.md (implementer already flagged). Cosmetic; rename for
  strict consistency with the manifest name if desired.

## Notes / non-issues (checked, no action)

- package.json `name` = `obsidian-visit-history-plugin` contains "obsidian"/
  "plugin" — this is the npm/repo package name, NOT the manifest `id`; bot
  naming rules apply only to the manifest, so this is fine.
- Attestation covers main.js + SHA256SUMS + styles.css but not manifest.json
  directly — acceptable, manifest.json is covered transitively via SHA256SUMS.
- Manual `gh` fallback in the doc creates a non-draft release with
  `--generate-notes` while the automated path is `--draft` — intentional
  (hotfix ergonomics), documented as such.

## Overall

The change does exactly what CLARIFICATION asked and follows the research
ground-truth. The one substantive gap (S1) is a small hardening of the verify
helper, not a release blocker. Ship-ready.
