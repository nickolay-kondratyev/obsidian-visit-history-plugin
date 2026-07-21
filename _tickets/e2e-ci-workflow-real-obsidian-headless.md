---
id: nid_u48zcq4xb5jni7w3jrwqdc405_E
title: "e2e: CI workflow running the real-Obsidian Playwright suite headless"
status: open
deps: []
links: []
created_iso: 2026-07-21T16:30:00Z
status_updated_iso: 2026-07-21T16:30:00Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, ci, playwright]
---

Add a `.github/workflows` job that runs `npm run test:e2e` (real headless Obsidian).

Needs: `git submodule update --init` → `npm ci` → `npm run test:e2e`. The suite
auto-downloads the pinned Obsidian (`scripts/setup-obsidian-bin.sh`) and injects the
headless Ozone flags itself. Cache the Obsidian binary across runs via a named volume /
actions cache keyed on the pinned version (set `OBSIDIAN_CACHE_DIR`). Runner must have
the Chromium/Electron runtime libs (libnss3, libgtk-3, libgbm, libasound2, …).

Acceptance: a CI run executes all 5 e2e specs green on a display-less Linux runner, and
the Obsidian download is reused on a second run.
