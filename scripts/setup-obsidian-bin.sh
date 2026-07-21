#!/usr/bin/env bash
# Provision + cache a real Obsidian (Electron) binary for the e2e suite.
#
# Contract (see .out/tmp_doc/e2e-obsidian-docker-setup.md §1):
#   - stdout = the resolved binary path ONLY (so callers can do
#     OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)").
#   - ALL logging goes to stderr.
#   - Download-once + cache: a second run reuses the extracted binary.
#   - Uses the platform .tar.gz (NOT the AppImage) — extracts to a plain dir with
#     a runnable `obsidian`, needing no FUSE / --appimage-extract (absent in containers).
set -euo pipefail

# Pin deliberately — a floating "latest" lets a new Obsidian release break e2e with
# no code change. Bump this on purpose.
OBSIDIAN_VERSION="1.12.7"

log() { printf '%s\n' "$*" >&2; }

os="$(uname -s)"
if [[ "${os}" != "Linux" ]]; then
  log "ERROR: setup-obsidian-bin.sh auto-download supports Linux only (got '${os}')."
  log "       macOS/Windows ship .dmg/.exe, not a drop-in binary."
  log "       Set OBSIDIAN_PATH to a local Obsidian binary and re-run."
  exit 1
fi

arch="$(uname -m)"
case "${arch}" in
  x86_64|amd64) asset="obsidian-${OBSIDIAN_VERSION}.tar.gz" ;;
  aarch64|arm64) asset="obsidian-${OBSIDIAN_VERSION}-arm64.tar.gz" ;;
  *) log "ERROR: unsupported arch '${arch}'."; exit 1 ;;
esac

# Repo-local default keeps the cache inside the already-gitignored .tmp/.
# Override with OBSIDIAN_CACHE_DIR for a shared cross-checkout cache.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="${OBSIDIAN_CACHE_DIR:-${repo_root}/.tmp/obsidian}"
extract_dir="${CACHE_DIR}/${OBSIDIAN_VERSION}"
# The tarball extracts to a top-level "obsidian-<version>" dir containing the
# `obsidian` binary (verified against the 1.12.7 x86_64 tarball).
binary="${extract_dir}/obsidian-${OBSIDIAN_VERSION}/obsidian"

if [[ -x "${binary}" ]]; then
  log "Obsidian ${OBSIDIAN_VERSION} already cached at ${binary}"
  printf '%s\n' "${binary}"
  exit 0
fi

url="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/${asset}"
log "Downloading Obsidian ${OBSIDIAN_VERSION} (${arch}) from ${url}"
mkdir -p "${extract_dir}"
archive="${extract_dir}/${asset}"

# --fail: non-2xx -> non-zero exit; --location: follow the GitHub redirect.
# WHY-NOT checksum: Obsidian publishes a hash only for the .asar payload, not the
# platform tarball; curl --fail + tar validity is the 80/20 integrity guard.
curl --fail --location --retry 3 --output "${archive}" "${url}"
log "Extracting ${asset}"
tar -xzf "${archive}" -C "${extract_dir}"
rm -f "${archive}"

if [[ ! -x "${binary}" ]]; then
  log "ERROR: expected binary not found/executable after extract: ${binary}"
  log "       Tarball layout may have changed; inspect ${extract_dir}"
  exit 1
fi

log "Obsidian ${OBSIDIAN_VERSION} ready at ${binary}"
printf '%s\n' "${binary}"
