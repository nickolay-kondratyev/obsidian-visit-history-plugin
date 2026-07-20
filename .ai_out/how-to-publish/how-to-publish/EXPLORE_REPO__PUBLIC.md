# Explore: Publishing/Release State of obsidian-visit-history-plugin

_(Captured by TOP_LEVEL_AGENT from the read-only Explore sub-agent, which could not write files.)_

## 1. manifest.json (root)
```json
{
  "id": "vintrin-visit-history-plugin",
  "name": "Visit History Plugin",
  "version": "0.0.10",
  "minAppVersion": "1.5.7",
  "description": "Records the visit history of notes and canvases.",
  "author": "Nickolay Kondratyev",
  "authorUrl": "http://glassthought.com",
  "fundingUrl": "http://glassthought.com",
  "isDesktopOnly": false
}
```
- `id` = `vintrin-visit-history-plugin` — does NOT match repo name `obsidian-visit-history-plugin` nor `package.json` name.
- `name` = "Visit History Plugin" (contains word "Plugin").
- `description` here is staler/shorter than package.json's.
- `authorUrl`/`fundingUrl` both `http://glassthought.com` (http, not https).

## 2. versions.json (root)
```json
{ "1.0.0": "1.0.0", "0.0.10": "1.5.7" }
```
- Stray `"1.0.0": "1.0.0"` entry — no such tag/manifest version. Suspicious leftover.
- Non-chronological order.

## 3. package.json (root)
- `name`: `obsidian-visit-history-plugin`; `version`: `0.0.10` (in sync w/ manifest).
- `description`: "Records the visit history of notes and canvases, and visualizes vault activity as a treemap heatmap." (richer than manifest).
- `"license": "0-BSD"` — CONTRADICTS actual `LICENSE.md` (custom KSAL-2.3, source-available, commercial restrictions).
- scripts: `dev`, `build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`), `version` (`node version-bump.mjs && git add manifest.json versions.json`), `lint`, `test` (vitest run), `test:lib`.
- No dedicated `release` script.
- `obsidian-id-lib` is `file:submodules/obsidian-id-lib` (git submodule) → CI must `git submodule update --init --recursive`.

## 4. version-bump.mjs
Standard unmodified Obsidian-sample-plugin script: reads `npm_package_version`, writes into `manifest.json.version`, appends `{version: minAppVersion}` to `versions.json` if absent. Does NOT bump `minAppVersion` (hand-edit before `npm version`).

## 5. esbuild.config.mjs
- Entry `src/main.ts` → CJS `main.js` at root, target es2021.
- `npm run build` = `tsc -noEmit` + production esbuild (minified, no sourcemap).
- Only `main.js` is generated. `styles.css` is hand-authored & git-tracked.

## 6. .github/workflows/ — RELEASE PIPELINE ALREADY EXISTS
### lint.yml
- push + PR any branch; Node 20/22/24; checkout→setup-node→`npm ci`→`npm run build --if-present`→`npm run lint`.
- GAP: no `submodules: true` in checkout, yet `obsidian-id-lib` is a `file:` submodule dep → `npm ci` may fail. Flag.
### release.yml
- Trigger: push of ANY tag (`tags: ['*']`), no `v` prefix requirement.
- Permissions: `contents: write`, `id-token: write`, `attestations: write`.
- Steps: checkout → setup-node (24) → `npm ci && npm run build` → detect styles.css → `actions/attest@v4` (build provenance for main.js [+ styles.css]) → `gh release create "$tag" --title="$tag" --draft main.js manifest.json [styles.css]` via GITHUB_TOKEN.
- Result: tag push → builds → **DRAFT** release w/ assets + attestation. Human must un-draft.
- Same submodule-checkout caveat as lint.yml.
- NEVER run: no git tags exist. Current version 0.0.10 never released.

## 7. docs/ structure & style
```
docs/README.md (index: prose + table + Dev quickstart bash block)
docs/architecture.md, docs/heatmap-view.md, docs/visit-history-format.md
docs/migration/extraction-of-id.md
docs/tickets/ (11 ticket write-ups)
```
Style to match: H1, no frontmatter, short prose then lists/tables, fenced ```bash, relative links. Add a row to docs/README.md table for the new doc. Root README.md links to docs/ at README.md:55.

## 8. Git identity
- Remote: `git@github.com:nickolay-kondratyev/obsidian-visit-history-plugin.git`
- Owner `nickolay-kondratyev`, repo `obsidian-visit-history-plugin`.
- No tags exist (never released). Submodule `submodules/obsidian-id-lib` → separate repo.

## 9. Root artifacts / .gitignore
- `main.js` exists at root but is git-IGNORED (`.gitignore`: "uploaded to GitHub releases instead").
- `styles.css` exists & IS tracked. `manifest.json`, `versions.json` tracked.

## 10. Community plugin list status
- NOT yet submitted (no community-plugins references besides sample boilerplate in `README_ORIGINAL.md`).
- `README_ORIGINAL.md` still present — upstream sample-plugin boilerplate (release + submission instructions). New doc supersedes it.
- POTENTIAL BLOCKER: LICENSE.md = custom KSAL-2.3 source-available (non-OSS, commercial restrictions). Obsidian community list generally expects permissive/free. Surface as maintainer decision.
- package.json `"license":"0-BSD"` contradicts LICENSE.md — fix/flag.

## 11. CHANGELOG
- None exists. History tracked via `.ai_out/**` prose + commit messages. New CHANGELOG would be net-new.

## 12. gh CLI
- Installed `/usr/bin/gh` v2.23.0 (Feb 2023, old), but NOT authenticated (`gh auth status`: not logged in). Scripts must note `gh auth login`/`GH_TOKEN` prereq.

## Summary
Working standard release pipeline already exists (version-bump + `npm version` + tag-triggered `release.yml` with attestation → draft release) but never used. Gaps before writing the doc/bump/naming: (1) manifest `id` mismatch, (2) package.json license contradiction + custom non-OSS license submission-blocker, (3) stray versions.json `1.0.0` entry, (4) manifest/name contain "Plugin", (5) description drift, (6) http not https URLs, (7) CI submodule-checkout gap.
