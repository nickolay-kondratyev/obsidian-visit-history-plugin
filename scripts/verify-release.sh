#!/usr/bin/env bash
#
# verify-release.sh — verify a published Visit History release.
#
# Downloads the release assets, verifies the SLSA build-provenance attestation
# (proves the assets were built by this repo's GitHub Actions runner) and the
# SHA256SUMS checksums.
#
# Usage:
#   scripts/verify-release.sh <version>     # e.g. 1.0.0
#
# Prereqs: `gh` authenticated (`gh auth login`). Downloads into a temp dir.
set -euo pipefail

REPO="nickolay-kondratyev/obsidian-visit-history-plugin"

die() { echo "verify-release.sh: $*" >&2; exit 1; }

[[ "$#" -eq 1 ]] || die "usage: scripts/verify-release.sh <version>"
VERSION="$1"

command -v gh >/dev/null 2>&1 || die "gh (GitHub CLI) is required"
command -v sha256sum >/dev/null 2>&1 || die "sha256sum is required"
gh auth status >/dev/null 2>&1 || die "gh not authenticated — run: gh auth login"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

echo "verify-release.sh: downloading assets for $VERSION from $REPO..."
gh release download "$VERSION" --repo "$REPO"

echo
echo "verify-release.sh: verifying build-provenance attestation for main.js..."
gh attestation verify main.js --repo "$REPO"

echo
echo "verify-release.sh: verifying build-provenance attestation for SHA256SUMS..."
# Attest SHA256SUMS itself BEFORE trusting it, so the checksums that vouch for
# manifest.json / styles.css are rooted in provenance, not an unauthenticated file.
[[ -f SHA256SUMS ]] || die "SHA256SUMS not found in release assets"
gh attestation verify SHA256SUMS --repo "$REPO"

echo
echo "verify-release.sh: verifying checksums (SHA256SUMS)..."
sha256sum -c SHA256SUMS

echo
echo "verify-release.sh: OK — attestation + checksums verified for $VERSION."
