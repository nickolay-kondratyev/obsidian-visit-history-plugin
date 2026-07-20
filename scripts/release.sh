#!/usr/bin/env bash
#
# release.sh — cut a Visit History plugin release.
#
# Bumps the version (package.json + manifest.json + versions.json via
# version-bump.mjs), commits, creates a NO-'v'-prefix git tag matching the
# manifest version, and pushes branch + tag so .github/workflows/release.yml
# builds, attests provenance, generates SHA256SUMS, and opens a DRAFT release.
#
# Usage:
#   scripts/release.sh <patch|minor|major|x.y.z>
#
# Examples:
#   scripts/release.sh patch      # 1.0.0 -> 1.0.1
#   scripts/release.sh 1.0.0      # first release: files already at 1.0.0 -> just tag
#
# Prereqs: clean working tree, git remote 'origin', push rights. The tag push
# fires the release workflow; you then review and PUBLISH the draft release.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DEFAULT_BRANCH="master"

die() { echo "release.sh: $*" >&2; exit 1; }

[ "$#" -eq 1 ] || die "usage: scripts/release.sh <patch|minor|major|x.y.z>"
BUMP="$1"

command -v jq >/dev/null 2>&1 || die "jq is required"

# Preconditions: clean tree.
[ -z "$(git status --porcelain)" ] || die "working tree not clean — commit or stash first"

# Warn (do not block) if not on the default branch.
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]; then
  echo "release.sh: WARNING — on branch '$CURRENT_BRANCH', not '$DEFAULT_BRANCH'." >&2
fi

CURRENT_VERSION="$(jq -r .version package.json)"

# If an explicit x.y.z equal to the current version is requested, the files are
# already at target (e.g. the very first release): tag the current commit
# instead of running `npm version` (which would fail with "Version not changed").
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && [ "$BUMP" = "$CURRENT_VERSION" ]; then
  echo "release.sh: package.json already at $CURRENT_VERSION — tagging current commit."
  NEW_VERSION="$CURRENT_VERSION"
else
  # `--tag-version-prefix=` keeps the tag as x.y.z (Obsidian forbids a 'v' prefix).
  # `npm version` runs the package.json "version" script (version-bump.mjs), then
  # commits and tags.
  npm version "$BUMP" --tag-version-prefix=
  NEW_VERSION="$(jq -r .version package.json)"
fi

# Guard: manifest.json and package.json versions MUST agree (version-bump.mjs
# syncs them; a mismatch means the bump machinery is broken).
MANIFEST_VERSION="$(jq -r .version manifest.json)"
[ "$MANIFEST_VERSION" = "$NEW_VERSION" ] || \
  die "manifest.json version ($MANIFEST_VERSION) != package.json version ($NEW_VERSION)"

# Ensure the tag exists locally (npm version creates it on the bump path; on the
# already-at-target path we create it here).
if ! git rev-parse -q --verify "refs/tags/$NEW_VERSION" >/dev/null; then
  git tag -a "$NEW_VERSION" -m "$NEW_VERSION"
fi

echo "release.sh: pushing branch '$CURRENT_BRANCH' and tag '$NEW_VERSION'..."
git push origin "$CURRENT_BRANCH"
git push origin "refs/tags/$NEW_VERSION"

cat <<EOF

Done. Tag $NEW_VERSION pushed.
Next steps:
  1. Watch the release workflow:  gh run watch  (or the Actions tab)
  2. Review the DRAFT release GitHub created (assets: main.js, manifest.json,
     styles.css, SHA256SUMS + attestation).
  3. Verify locally once published:  scripts/verify-release.sh $NEW_VERSION
  4. Publish the draft release when satisfied.
EOF
