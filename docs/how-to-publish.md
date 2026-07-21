# How to Publish Visit History

How to cut a release of this plugin and get it into the Obsidian community
plugin directory. Repo: `nickolay-kondratyev/obsidian-visit-history-plugin`;
plugin id: `visit-history`.

There are two distinct events, and people conflate them:

1. **A GitHub release** — every version, forever. Build the three files and
   attach them to a tag.
2. **The community-list submission** — a ONE-TIME pull request to
   `obsidianmd/obsidian-releases`. After that, new versions need no PR.

## The release model

- The **git tag MUST equal `manifest.json` `version`, with NO `v` prefix**
  (`1.0.0`, never `v1.0.0`). SemVer `x.y.z` only.
- Attach `main.js`, `manifest.json`, and `styles.css` as **individual files**
  on the GitHub release — never only inside the auto-generated source zip.
  Obsidian's installer downloads those three files by name.
- `manifest.json` must exist both at the repo root (the review bot reads it)
  and as a release asset (the installer downloads it).
- `versions.json` maps each plugin version → the minimum Obsidian app version
  it needs (`minAppVersion`). A user on an older app is offered the newest
  plugin release that still lists a compatible `minAppVersion`. It is updated
  automatically by `version-bump.mjs` on each bump.

`main.js` is git-ignored (see `.gitignore`) and produced by `npm run build`;
it only ever lives on releases, not in the repo.

## Automated path (recommended)

The build happens on GitHub's runners via
[`.github/workflows/release.yml`](../.github/workflows/release.yml), triggered
by pushing a tag. The workflow:

1. Checks out the repo (`obsidian-id-lib` resolves from npm — no submodule).
2. `npm ci && npm run build`.
3. Verifies the tag equals `manifest.json` `version`.
4. Generates `SHA256SUMS` over the assets.
5. Attests **SLSA build provenance** (`actions/attest`) for `main.js`,
   `SHA256SUMS`, and `styles.css`.
6. **Publishes** the GitHub release (marked `latest`) with all assets attached.
   The step **fails if a release already exists for the tag** — delete the
   stale release (and re-push the tag) before re-running.

Use the helper script:

```bash
# first release — files are already at 1.0.0, so this just tags + pushes:
scripts/release.sh 1.0.0

# later releases — bump, commit, tag, push:
scripts/release.sh patch     # 1.0.0 -> 1.0.1
scripts/release.sh minor     # 1.0.0 -> 1.1.0
```

[`scripts/release.sh`](../scripts/release.sh) verifies a clean tree, runs
`npm version <arg> --tag-version-prefix=` (no `v`), guards that
`manifest.json` and `package.json` versions agree, then pushes the branch and
the tag. The tag push fires `release.yml`.

> One-time repo setting: **Settings → Actions → General → Workflow permissions
> → Read and write permissions** (so the workflow can create the release).

After it publishes, verify the artifacts:

```bash
scripts/verify-release.sh 1.0.0
```

## Manual `gh` fallback

For a one-off/hotfix release from your laptop (no attestation — see below):

```bash
gh auth login          # one-time; gh must be authenticated
npm ci && npm run build
tag="$(jq -r .version manifest.json)"
sha256sum main.js manifest.json styles.css > SHA256SUMS
gh release create "$tag" \
  main.js manifest.json styles.css SHA256SUMS \
  --title "$tag" \
  --generate-notes
```

A laptop build cannot be attested (attestation needs GitHub's OIDC identity),
so prefer the automated path for anything users will install.

## Verifiable builds

The automated release attaches a **build-provenance attestation**: SLSA
provenance binding each artifact's SHA-256 digest to the exact repo, commit,
and workflow that produced it, signed keylessly via Sigstore (no keys to
manage). It only works for builds that run on GitHub's runners.

Anyone can verify a downloaded asset. `main.js` and `SHA256SUMS` are both
attested directly:

```bash
gh attestation verify main.js --repo nickolay-kondratyev/obsidian-visit-history-plugin
gh attestation verify SHA256SUMS --repo nickolay-kondratyev/obsidian-visit-history-plugin
```

Once `SHA256SUMS` itself is attested, confirm the integrity of every other
asset (manifest.json, styles.css) against it:

```bash
sha256sum -c SHA256SUMS
```

`scripts/verify-release.sh <version>` does all of this after downloading the
release.
Note: Obsidian's installer does not yet check attestations automatically —
this is for security-conscious users and auditors.

## First submission vs. updates

**First submission (one time).** After your first GitHub release exists, open
a PR to [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)
adding one entry to the end of `community-plugins.json`:

```json
{
    "id": "visit-history",
    "name": "Visit History",
    "author": "Nickolay Kondratyev",
    "description": "Records the visit history of notes and canvases, and visualizes vault activity as a treemap heatmap.",
    "repo": "nickolay-kondratyev/obsidian-visit-history-plugin"
}
```

A review bot plus a human check it. The `id`, `name`, and `description` here
must **byte-for-byte match** the repo's `manifest.json`.

**Every later version.** Do NOT touch `obsidian-releases` again — there is no
second PR, ever. Just push a new release (the automated path). Obsidian reads
your repo's releases via the recorded `repo` and offers the new version
in-app.

### Manifest field rules (bot rejections)

- `id`: lowercase `a-z0-9-`; must NOT contain `obsidian`; must NOT end with
  `plugin`. Permanent primary key once published — never change it. (Ours:
  `visit-history`. The id also determines the local data dir
  `.obsidian/plugins/visit-history/`.)
- `name`: must NOT contain "Obsidian" or the word "Plugin"; no emoji. (Ours:
  `Visit History`.)
- `description`: ≤ 250 chars, ends with a period, no emoji.
- Tag equals manifest `version`, no `v` prefix; `main.js` + `manifest.json`
  attached as individual assets.
- `isDesktopOnly` must be `true` if the plugin uses Node/Electron APIs (ours
  is `false`).
- Remove leftover sample code before submitting.

## License note

Obsidian imposes **no license-type requirement** — the only rule is that a
LICENSE file exists and the license is clearly indicated. A custom
source-available license is acceptable: **Smart Connections** ships a custom,
commercially-restricted license and remains listed in the community directory.
This plugin uses **KSAL-2.3** ([LICENSE.md](../LICENSE.md)), disclosed in the
[README](../README.md#license). `package.json` names it via the SPDX-valid
`LicenseRef-KSAL-2.3`. Comply with and attribute upstream licenses of any
bundled code (e.g. the `obsidian-id-lib` npm dependency, MIT).

## Pre-release checklist

- [ ] `npm run build`, `npm run lint`, `npm test` all green.
- [ ] `manifest.json` `version` bumped; `minAppVersion` correct.
- [ ] `manifest.json` and `package.json` versions agree.
- [ ] Description ≤ 250 chars, ends with a period, no emoji.
- [ ] Working tree clean; on the default branch.
- [ ] Notable changes noted for release notes.

## First-release runbook

1. Confirm `manifest.json` is at `1.0.0`, id `visit-history`, name
   `Visit History`.
2. `npm run build && npm run lint && npm test` — all green.
3. `scripts/release.sh 1.0.0` — tags `1.0.0` and pushes; `release.yml` builds and
   publishes the release (`latest`) with attestation + `SHA256SUMS`.
4. `scripts/verify-release.sh 1.0.0` — confirm assets, attestation + checksums.
6. Open the one-time `obsidian-releases` PR (see above); fix anything the bot
   flags in the same PR.
7. Future releases: just `scripts/release.sh patch|minor|major` — no PR.
