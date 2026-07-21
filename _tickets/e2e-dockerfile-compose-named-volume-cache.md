---
id: nid_fierpiwqfog6y05to77iwp2u6_E
title: "e2e: optional Dockerfile / compose with named-volume Obsidian cache"
status: open
deps: []
links: []
created_iso: 2026-07-21T16:30:00Z
status_updated_iso: 2026-07-21T16:30:00Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, docker]
---

If reproducible CI beyond the portable scripts is wanted: a Dockerfile (Chromium/Electron
runtime libs + Node) + docker-compose mounting the Obsidian binary cache as a named volume
(`OBSIDIAN_CACHE_DIR`), so the download survives container rebuilds.

Not required — the portable scripts already "just work" in a display-less Linux container
(verified: all 5 specs green headless). Low priority; do only on demand.
