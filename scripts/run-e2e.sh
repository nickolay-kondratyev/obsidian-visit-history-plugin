#!/usr/bin/env bash
# The `test:e2e` entry point (see .out/tmp_doc/e2e-obsidian-docker-setup.md §2).
# Guarantees an Obsidian binary + headless flags on a display-less host, seeds the
# dev-vault, typechecks the specs, then hands off to Playwright.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

# 1. Ensure a binary. Honour a caller-set OBSIDIAN_PATH untouched.
if [[ -z "${OBSIDIAN_PATH:-}" ]]; then
  OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"
  export OBSIDIAN_PATH
fi

# 2. Headless: no display server → Electron needs Chromium's offscreen Ozone backend
#    or it dies on boot. An explicit OBSIDIAN_E2E_EXTRA_ARGS always wins.
if [[ -z "${OBSIDIAN_E2E_EXTRA_ARGS:-}" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"
fi

# 3. Seed the vault (build + install plugin), typecheck specs, run Playwright.
npm run setup:dev-vault
npx tsc -p e2e/tsconfig.json
exec npx playwright test --config e2e/playwright.config.ts "$@"
