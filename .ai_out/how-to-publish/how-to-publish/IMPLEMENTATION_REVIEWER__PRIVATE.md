# IMPLEMENTATION_REVIEWER__PRIVATE — how-to-publish

Commit reviewed: c94cf9a (branch how-to-publish). Verdict: READY.

## Key verifications done
- `v`-prefix tag: release.sh uses `npm version --tag-version-prefix=` → no `v`. HANDLED. Not a bug.
- `actions/attest@v4`: WebFetched github.com/actions/attest — v4.2.0 latest (2026-07),
  DEFAULTS to SLSA build provenance with only subject-path. So the workflow is CORRECT
  even though RESEARCH snippet said `attest-build-provenance@v4`. This action was
  pre-existing in release.yml, not introduced by this commit.
- Metadata all exact: id visit-history, name Visit History, 1.0.0==1.0.0, desc 100 chars ends '.',
  versions.json {"1.0.0":"1.5.7"}, license LicenseRef-KSAL-2.3. All JSON valid.
- LICENSE.md exists; README `### License` anchor exists; doc links resolve; scripts +x, bash -n OK.

## Findings
- S1 (SHOULD-FIX): verify-release.sh never `gh attestation verify SHA256SUMS`, so
  manifest.json/styles.css authenticity not cryptographically established. Add one line.
- N1: release.sh doesn't build/test before tagging. N2: re-run tag push fails. N3: stale H1 branding.

## No BLOCKING issues. Nothing else code-touching changed (config/docs/CI only; 358 tests per impl doc).
