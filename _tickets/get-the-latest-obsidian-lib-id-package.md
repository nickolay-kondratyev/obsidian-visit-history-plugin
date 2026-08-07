---
closed_iso: 2026-08-07T18:28:10Z
id: nid_ofesxo1t2v9jfbr27o3twafs9_e
title: Get the latest obsidian lib id package
status: closed
deps: []
links: []
created_iso: '2026-08-07T18:19:43Z'
status_updated_iso: 2026-08-07T18:28:10Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin
---
Get the latest obsidian lib id package. 
Validate that nothing broke and get us ready for release with the updates dependency.

## Resolution (completed)

Bumped `obsidian-id-lib` from `0.1.0` → `0.1.1` (latest published; a patch
release, `deps: none`). `package.json` now pins `^0.1.1`; `package-lock.json`
updated via `npm install`.

Validation — all green against the new dependency:
- `npm run build` — clean (tsc `-noEmit` + esbuild production).
- `npm run lint` — ZERO errors (this is Obsidian's publish-time validation).
- `npm test` — 441 tests / 45 files all pass.

Release readiness:
- Bumped plugin version `1.0.12` → `1.0.13` via `npm version patch`
  (synced `manifest.json` + `versions.json` → minAppVersion `1.7.2`).
- Re-ran the production build; artifacts (`main.js`, `manifest.json`,
  `styles.css`) generate cleanly. `main.js` remains gitignored (not committed).

Commits on this branch:
- `Update obsidian-id-lib 0.1.0 → 0.1.1`
- `1.0.13`

Remaining human step (per CLAUDE.md release convention): cut the GitHub
release tagged `1.0.13` (no `v` prefix) and attach `main.js`, `manifest.json`,
`styles.css`.
