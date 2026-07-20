# CLARIFICATION__PUBLIC — how-to-publish

Human decisions (2026-07-20):

| # | Decision | Value |
|---|----------|-------|
| Q1 | Plugin `id` | **`visit-history`** (was `vintrin-visit-history-plugin`) |
| Q2 | Plugin `name` | **"Visit History"** (was "Visit History Plugin") |
| Q3 | Version bump | **`1.0.0`** (first real public release); ALSO remove stray `"1.0.0":"1.0.0"` entry from versions.json before the bump |
| Q4 | License | Use **`KSAL-2.3`** everywhere license metadata is required — BUT FIRST verify custom/source-available licenses are accepted in `obsidianmd/obsidian-releases` (Smart Connections precedent, custom license akin to KSAL). If verified OK → proceed; if NOT ok → STOP and surface to human. |
| Q5 | CI/scripts | **a + b**: improve `release.yml` to attach `SHA256SUMS` checksums AND fix the submodule-checkout gap (both lint.yml + release.yml). Automated, verifiable release desired. |

## Implementation scope (agreed)
1. Package prep / naming cleanup:
   - manifest.json: `id` → `visit-history`, `name` → `Visit History`, refresh `description` (≤250 chars, ends with period, no emoji; align with package.json), `authorUrl`/`fundingUrl` → https, version → 1.0.0.
   - package.json: version → 1.0.0, license → KSAL-2.3 (valid representation), description aligned.
   - versions.json: remove stray `1.0.0` mapping, then add correct `1.0.0` → minAppVersion.
   - Keep `minAppVersion` as-is unless a reason to change (currently 1.5.7).
2. `docs/how-to-publish.md` — research-backed guide (release mechanics, verifiable/attested builds, `gh` CLI, version bump flow, first-submission-to-community-list vs update, checksums). Match docs/ style; add row to docs/README.md.
3. Helper release script(s) — CLI-lean (`gh`), ease publishing (tag + push driving the Actions workflow; local verify helper).
4. `release.yml` + `lint.yml`: submodule checkout fix; `release.yml`: attach SHA256SUMS.
5. Version bumped throughout to 1.0.0.

## Callouts to carry forward
- Custom non-OSS license (KSAL-2.3) — pending community-list acceptance verification (Q4).
- Remove/keep `README_ORIGINAL.md` (sample boilerplate) — superseded by the new doc; decide during impl (low priority).
