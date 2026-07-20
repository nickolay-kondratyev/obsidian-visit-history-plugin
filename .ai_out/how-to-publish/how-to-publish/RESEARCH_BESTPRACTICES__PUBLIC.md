# Publishing an Obsidian Community Plugin — Current (2025–2026) Best Practices

Research focus: verifiable/provenance-friendly releases and CLI-driven workflows.
All claims cited inline. Compiled 2026-07.

---

## TL;DR (for the impatient)

- **Release tag == `manifest.json` `version`, with NO leading `v`** (`1.0.0`, not `v1.0.0`). SemVer `x.y.z` only.
- Attach **`main.js`, `manifest.json`, `styles.css` as individual binary assets** — NOT inside a zip / source tarball. `styles.css` is optional (only if you ship CSS).
- **First submission** = one PR to `obsidianmd/obsidian-releases` (add an entry to `community-plugins.json`), reviewed by a bot + humans. **Updating an already-listed plugin = just push a new GitHub release.** No further PR ever.
- For verifiability, the modern move is **GitHub Actions artifact attestations** (`actions/attest-build-provenance`, SLSA build provenance) verified with `gh attestation verify`. A realistic solo fallback is an attached `SHA256SUMS` + a signed git tag.
- The **recommended modern release path is a tag-triggered GitHub Actions workflow**, not manual `gh` from your laptop — it's what the official docs ship and it's what makes attestation trustworthy (build happens on GitHub's runners, not your machine).

---

## 1. Obsidian release requirements (the hard rules)

Sources: [Submission requirements for plugins](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins), [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin), [obsidianmd/obsidian-releases README](https://github.com/obsidianmd/obsidian-releases), [Release your plugin with GitHub Actions](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions).

| Requirement | Rule |
|---|---|
| **Release tag** | Must **exactly match** the `version` in `manifest.json`. **No `v` prefix** — use `1.0.0`, never `v1.0.0`. |
| **Versioning** | Semantic Versioning, `MAJOR.MINOR.PATCH` (`x.y.z`) only. No pre-release suffixes for the listed version. |
| **Required assets** | `main.js` **(required)** and `manifest.json` **(required)** attached as **individual binary files** to the GitHub release. |
| **Optional asset** | `styles.css` — attach only if your plugin ships CSS. |
| **NOT allowed** | Providing the files only inside the auto-generated Source code `.zip`/`.tar.gz`. Obsidian's installer downloads the three files individually from the release assets, so they must exist as standalone assets. |
| **`manifest.json` locations** | Must exist BOTH at the repo root (this is what the review bot reads) AND as a release asset (this is what the installer downloads). Their `version` values are what differs — root manifest = latest, asset manifest = that release's version. |

**What Obsidian downloads on install/update:** "Obsidian will download `manifest.json`, `main.js`, and `styles.css` (if available)" from the GitHub release matching the tag ([obsidian-releases README](https://github.com/obsidianmd/obsidian-releases)).

### `minAppVersion`
> "The `minAppVersion` in the Manifest should be set to the minimum required version of the Obsidian app that your plugin is compatible with." ([Submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins))

Bump it manually in `manifest.json` **before** running the version bump — the bump script copies it into `versions.json`.

### `versions.json` role
`versions.json` maps **each plugin version → the minimum Obsidian app version it needs**:

```json
{
	"1.0.0": "1.0.0",
	"1.1.0": "1.4.0"
}
```

Obsidian uses this so that a user on an **older** app version is offered the newest plugin release that still supports their app, rather than a newer plugin release that would break. It lives at the repo root and is updated automatically by `version-bump.mjs` (see §6). Source: [obsidian-sample-plugin `versions.json`](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/versions.json) + [version-bump.mjs](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/version-bump.mjs).

---

## 2. `manifest.json` best practices & common review-bot rejections

Source: [Manifest reference](https://docs.obsidian.md/Reference/Manifest), [Submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins).

### Canonical manifest (from the sample plugin)
```json
{
	"id": "sample-plugin",
	"name": "Sample Plugin",
	"version": "1.0.0",
	"minAppVersion": "1.0.0",
	"description": "Demonstrates some of the capabilities of the Obsidian API.",
	"author": "Obsidian",
	"authorUrl": "https://obsidian.md",
	"fundingUrl": "https://obsidian.md/pricing",
	"isDesktopOnly": false
}
```
([obsidian-sample-plugin/manifest.json](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/manifest.json))

### Field rules

- **`id`** (required, plugin-only): unique identifier. **Lowercase letters, digits and hyphens only** (`[a-z0-9-]`; underscores are sometimes tolerated but stick to `a-z0-9-`). **Must NOT contain the word `obsidian`. Must NOT end with `plugin`.** Should match the plugin folder name for local dev (otherwise some hooks like `onExternalSettingsChange` won't fire). Once published it is the primary key and can never change. If the `id` already exists in `community-plugins.json`, the bot rejects the PR.
- **`name`** (required): short, descriptive, English/Basic-Latin. **Must NOT contain "Obsidian" (or variants like "Obsi-" / "-sidian") and must NOT contain the word "Plugin".** No emoji/special chars; hyphens/plus/parentheses only for punctuation. Must be unique and not collide with an Obsidian core feature name.
- **`description`** (required): **≤ 250 characters, must end with a period, no emoji/special characters.** Prefer an action phrase ("Records…", "Generate…", "Translate…"). Overlong or emoji-laden descriptions are a frequent bot rejection.
- **`author`** (required): your name/handle.
- **`authorUrl`** (optional): link to your site/GitHub profile. Do NOT point it at the plugin repo (that's implied by the listing).
- **`fundingUrl`** (optional): Buy Me a Coffee / GitHub Sponsors, etc. Can be a single string OR an object of `{ "Label": "url" }` for multiple funding links.
- **`minAppVersion`** (required): see §1.
- **`isDesktopOnly`** (required, boolean): set `true` **if you use any Node.js or Electron APIs** (`require('fs')`, `child_process`, Electron modules, etc.). Setting it wrong = mobile users get a broken plugin, a common review flag.

### Recurring review-bot / reviewer rejections (in practice)
- `v`-prefixed release tag, or tag ≠ manifest version.
- Missing `main.js`/`manifest.json` as individual assets (only zip attached).
- `id`/`name` containing "obsidian" or "plugin".
- `id`, `name`, or `description` in the PR's `community-plugins.json` entry **not byte-for-byte matching** the repo `manifest.json`.
- Description > 250 chars / doesn't end with a period / has emoji.
- Leftover sample code ("Sample code should be removed from your plugin before submission." — [Submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)).
- `isDesktopOnly` not set while using Node/Electron APIs.

---

## 3. First submission vs. updating an already-listed plugin

**These are completely different, and this trips people up.**

### First submission (one-time)
1. Publish source on GitHub and create your first GitHub release (tag = manifest version, assets attached).
2. Open a **pull request against [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)** adding one object to the END of `community-plugins.json`:
   ```json
   {
       "id": "your-plugin-id",
       "name": "Your Plugin Name",
       "author": "Your Name",
       "description": "Short description ending with a period.",
       "repo": "your-github-user/your-repo"
   }
   ```
   The `repo` is the `owner/name` GitHub slug — that's how Obsidian later fetches every release.
3. The **`validate-plugin-entry.yml` review bot** runs automatic checks (id uniqueness, id/name/description match the repo manifest, naming rules, release assets present, etc.), then a human reviewer follows up. Fix anything the bot flags in the same PR. Sources: [Plugin Submission Guide (DeepWiki)](https://deepwiki.com/obsidianmd/obsidian-releases/6.1-plugin-submission-guide), [obsidian-releases README](https://github.com/obsidianmd/obsidian-releases).

> Note: The official [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) page now frames this as a flow through **community.obsidian.md** ("New plugin" → enter repo URL), which is the front-end that generates the `community-plugins.json` PR for you. Under the hood it is still the same `obsidian-releases` PR + bot validation.

### Updating an already-listed plugin (every subsequent release)
- **You do NOT touch `obsidian-releases` again. There is no second PR, ever.**
- You simply **create a new GitHub release** in your own repo with a new tag matching the new `manifest.json` version, with the three assets attached.
- Obsidian periodically reads your repo's releases (via the `repo` recorded at submission) and offers the new version to users in-app.
- The `community-plugins.json` entry only carries `id/name/author/description/repo` — none of which encode the version — so it never needs updating for a version bump. (Editing name/description later, or transferring the repo, is the only reason to touch it again.)

Sources: [obsidian-releases README](https://github.com/obsidianmd/obsidian-releases), [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin).

---

## 4. Verifiable / provenance builds

Goal: let a user (or Obsidian) cryptographically confirm that the `main.js` in a release was built from a specific commit of your source, by GitHub's runners, not tampered with.

### Option A — GitHub Artifact Attestations (RECOMMENDED, modern)
`actions/attest-build-provenance` generates **SLSA build provenance** for your release artifacts during the Actions run. It binds each artifact (name + SHA-256 digest) to an in-toto SLSA provenance predicate, signs it with a **short-lived Sigstore certificate** (public-good Sigstore for public repos), and uploads it to GitHub's attestations API tied to your repo. Baseline is **SLSA v1.0 Build Level 2** (Level 3 with reusable/hardened workflows). Sources: [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance), [Artifact attestations (GitHub Docs)](https://docs.github.com/en/actions/concepts/security/artifact-attestations), [Using artifact attestations](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations).

Required workflow permissions:
```yaml
permissions:
  contents: write       # create the GitHub Release
  id-token: write       # mint the OIDC token Sigstore needs
  attestations: write   # publish the attestation
```

Attestation step:
```yaml
- name: Attest build provenance
  uses: actions/attest-build-provenance@v4
  with:
    subject-path: |
      main.js
      manifest.json
      styles.css
```
(Source: [attestation forum thread](https://forum.obsidian.md/t/how-to-automate-artifact-attestation-for-releases/114445). Current major is **v4**; note GitHub is consolidating this into the newer generic [`actions/attest`](https://github.com/actions/attest) action — `attest-build-provenance@v4` still works and remains the documented Obsidian-community approach.)

Anyone then verifies a downloaded file with the GitHub CLI:
```bash
gh attestation verify main.js --repo your-user/your-repo
# or scope by owner:
gh attestation verify main.js --owner your-user
# machine-readable:
gh attestation verify main.js --repo your-user/your-repo --format json
# pin the exact workflow that signed it:
gh attestation verify main.js --repo your-user/your-repo --signer-workflow your-user/your-repo/.github/workflows/release.yml
```
(Source: [gh attestation verify manual](https://cli.github.com/manual/gh_attestation_verify).)

**Trade-offs:** Zero key management (Sigstore keyless), no secrets to leak, strongest guarantee, and it's the direction the Obsidian dev community is moving. Cost: the build MUST happen in GitHub Actions (a laptop build can't be attested by GitHub's OIDC identity), and verification requires the `gh` CLI — Obsidian's installer does not yet check attestations automatically, so today it mainly benefits security-conscious users and auditors.

### Option B — Checksums (simple, universal fallback)
Attach a `SHA256SUMS` file to the release:
```bash
sha256sum main.js manifest.json styles.css > SHA256SUMS
```
Users run `sha256sum -c SHA256SUMS`. **Weakness:** proves integrity of the download vs. what you published, but NOT provenance — a compromised release could ship matching sums. Best used *alongside* a signed tag.

### Option C — Signed git tags / signed commits (provenance of source)
```bash
git config gpg.format ssh                       # or use GPG
git config user.signingkey ~/.ssh/id_ed25519.pub
git tag -s 1.2.0 -m "1.2.0"                      # signed, annotated tag
git verify-tag 1.2.0
```
Proves *you* cut that source tag. **Weakness:** says nothing about whether the attached `main.js` was actually built from it (that's exactly the gap Option A closes). Also requires readers to have your public key.

### What's realistic for a solo Obsidian plugin
1. **Best ROI:** tag-triggered Actions workflow that builds on the runner **and** runs `attest-build-provenance@v4` (Option A). It's ~6 extra lines and gives real provenance with no key custody.
2. **Cheap add-on:** also generate and attach `SHA256SUMS` for users who won't install `gh`.
3. **Optional:** sign your tags (Option C) for source-side provenance.
Skipping heavyweight external notarization is a fine 80/20 call — the SLSA attestation from a GitHub-hosted build is the high-value, low-effort win.

---

## 5. CLI-driven release with `gh`

Source: [gh release create manual](https://cli.github.com/manual/gh_release_create).

Synopsis:
```
gh release create [<tag>] [<files>... | <patterns>...]
```

Minimal Obsidian release from a clean build:
```bash
# after: npm ci && npm run build   (produces main.js)
tag="$(jq -r .version manifest.json)"   # tag == manifest version, no 'v'

gh release create "$tag" \
  main.js manifest.json styles.css \
  --title "$tag" \
  --notes "See CHANGELOG for details."
```

Useful flags:
- `--title/-t` release title (use the bare version, matching the tag).
- `--notes/-n` inline notes, or `--notes-file/-F <file>` (`-` = stdin), or `--generate-notes` to auto-build notes from merged PRs/commits.
- `--draft/-d` create as a draft to review before publishing (recommended for the first automated runs — publish manually after eyeballing assets).
- `--target <branch|sha>` the commit to tag if the tag doesn't exist yet.
- `--verify-tag` abort unless the git tag already exists on the remote (guards against typo tags).
- `--latest` force the "Latest" badge (default is automatic).
- Asset display labels: `main.js#Plugin bundle`.

Add assets to an existing release later:
```bash
gh release upload "$tag" SHA256SUMS --clobber
```

Scripting best practices:
- Derive the tag from `manifest.json` (`jq -r .version`) so tag/manifest can never drift.
- Run `npm ci` (not `npm install`) + `npm run build` first; fail the script if `main.js` is missing.
- Prefer `--draft` for manual review, or drive it from Actions (§7) so the build is reproducible and attestable.
- If styles.css may be absent, guard it: `assets=(main.js manifest.json); [ -f styles.css ] && assets+=(styles.css)`.

---

## 6. Version bumping (the sample-plugin approach)

Sources: [version-bump.mjs](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/version-bump.mjs), [package.json](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/package.json).

`package.json` wires npm's version lifecycle to the bump script:
```json
"scripts": {
  "version": "node version-bump.mjs && git add manifest.json versions.json"
}
```

`version-bump.mjs` (verbatim from the sample plugin):
```js
import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

// update versions.json with target version and minAppVersion from manifest.json
// but only if the target version is not already in versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (!(targetVersion in versions)) {
	versions[targetVersion] = minAppVersion;
	writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
}
```

**Workflow:**
1. If needed, edit `minAppVersion` in `manifest.json` by hand first.
2. Run `npm version patch` (or `minor` / `major`). npm bumps `package.json`, then fires the `version` script which runs `version-bump.mjs`: it copies the new version into `manifest.json` and adds a `version → minAppVersion` entry to `versions.json`, then `git add`s both. npm also creates the commit and a git tag.
   - The default npm tag is `v1.2.0`. **Obsidian wants NO `v`.** Either set `git config tag.gpgSign`/`npm config set tag-version-prefix ""` so npm tags as `1.2.0`, or let the release come from an Actions workflow that derives the tag from `manifest.json` (§7) and don't rely on npm's tag at all.
3. Push commit + tag → your Actions workflow builds & releases.

SemVer discipline: PATCH = fixes, MINOR = backward-compatible features, MAJOR = breaking changes. Keep `versions.json` honest — only raise `minAppVersion` when you actually use a newer API.

---

## 7. Tag-triggered GitHub Actions workflow (RECOMMENDED modern approach)

**Yes — a tag-triggered Actions workflow is the recommended modern approach over manual `gh`.** It's what the official docs ship ([Release your plugin with GitHub Actions](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions)), it removes "build on my laptop" drift, and — critically — it's the ONLY way to get trustworthy build provenance (attestation must run on GitHub's OIDC-authenticated runner).

### Official baseline workflow (`.github/workflows/release.yml`)
Verbatim from the Obsidian docs ([source](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions)):
```yaml
name: Release Obsidian plugin

on:
  push:
    tags:
      - "*"

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18.x"

      - name: Build plugin
        run: |
          npm install
          npm run build

      - name: Create release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tag="${GITHUB_REF#refs/tags/}"

          gh release create "$tag" \
            --title="$tag" \
            --draft \
            main.js manifest.json styles.css
```
The doc also notes: set repo **Settings → Actions → Workflow permissions → Read and write** before the first tag push, and cut tags with `git tag -a 1.0.1 -m "1.0.1"` then `git push origin 1.0.1`.

### Recommended enhanced workflow (adds SLSA attestation + checksums)
This is the 80/20 upgrade — provenance for verifiable releases, still copy-pasteable:
```yaml
name: Release Obsidian plugin

on:
  push:
    tags:
      - "*"          # tag must equal manifest version, no 'v'

permissions:
  contents: write       # create the GitHub Release
  id-token: write       # OIDC token for Sigstore signing
  attestations: write   # publish build provenance

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          cache: "npm"

      - name: Install & build
        run: |
          npm ci
          npm run build

      - name: Verify tag matches manifest version
        run: |
          tag="${GITHUB_REF#refs/tags/}"
          manifest_version="$(jq -r .version manifest.json)"
          if [ "$tag" != "$manifest_version" ]; then
            echo "Tag ($tag) != manifest version ($manifest_version)" >&2
            exit 1
          fi

      - name: Generate checksums
        run: sha256sum main.js manifest.json styles.css > SHA256SUMS

      - name: Attest build provenance
        uses: actions/attest-build-provenance@v4
        with:
          subject-path: |
            main.js
            manifest.json
            styles.css

      - name: Create GitHub release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tag="${GITHUB_REF#refs/tags/}"
          gh release create "$tag" \
            --title "$tag" \
            --generate-notes \
            main.js manifest.json styles.css SHA256SUMS
```
Notes:
- Drop `styles.css` from both the `sha256sum`, `subject-path`, and `gh release create` lines if your plugin has no stylesheet (or guard it as in §5).
- Keep `--draft` on `gh release create` during your first runs, then remove it once you trust the pipeline.
- `actions/checkout@v4` / `setup-node@v4` / Node 20 are current; the official doc's `@v3`/Node 18 still works.
- Sources for the attestation block & permissions: [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance), [artifact-attestation Obsidian forum thread](https://forum.obsidian.md/t/how-to-automate-artifact-attestation-for-releases/114445), [GitHub Docs — Using artifact attestations](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations).

**Manual `gh` still has its place** for hotfix/one-off releases, but for a plugin you intend to keep verifiable, wire the workflow once and just push tags.

---

## Sources
- Obsidian — Submission requirements for plugins: https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins
- Obsidian — Submit your plugin: https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
- Obsidian — Manifest reference: https://docs.obsidian.md/Reference/Manifest
- Obsidian — Release your plugin with GitHub Actions: https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions
- obsidianmd/obsidian-releases (README + community-plugins.json): https://github.com/obsidianmd/obsidian-releases
- Plugin Submission Guide (DeepWiki mirror): https://deepwiki.com/obsidianmd/obsidian-releases/6.1-plugin-submission-guide
- obsidianmd/obsidian-sample-plugin: https://github.com/obsidianmd/obsidian-sample-plugin
  - version-bump.mjs: https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/version-bump.mjs
  - package.json / versions.json / manifest.json (same repo, master)
- GitHub — Artifact attestations (concept): https://docs.github.com/en/actions/concepts/security/artifact-attestations
- GitHub — Using artifact attestations: https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations
- actions/attest-build-provenance: https://github.com/actions/attest-build-provenance
- actions/attest (successor): https://github.com/actions/attest
- Obsidian forum — Automate artifact attestation for releases: https://forum.obsidian.md/t/how-to-automate-artifact-attestation-for-releases/114445
- gh release create manual: https://cli.github.com/manual/gh_release_create
- gh attestation verify manual: https://cli.github.com/manual/gh_attestation_verify
