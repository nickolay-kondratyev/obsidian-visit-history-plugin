---
id: nid_ie968mmm7zsqf5usda41ufxw3_e
title: "Replace lru-cache dependency with self-written LRU cache"
status: open
deps: []
links: []
created_iso: 2026-08-10T18:13:09Z
status_updated_iso: 2026-08-10T18:13:09Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [scorecard, dependency]
---

## Goal
Remove the `lru-cache` npm dependency and replace it with a small self-written
LRU so the Obsidian scorecard stops reporting its (false-positive) network call.

## Background
The scorecard flags "1 network call". Investigation (closed ticket
nid_kmnk1sasm5itvw3twkxj6wja4_e) proved it a FALSE POSITIVE: the static analyzer
counts the literal `fetch(` token in bundled `main.js`, which comes only from
`lru-cache`'s `fetch()`/`#fetch()` memoization methods (unrelated to
`window.fetch`/HTTP). We never call `.fetch()` — only `.get()`/`.set()`.
Dropping the dependency removes the token and yields a clean scorecard.

## Scope
`lru-cache` is used in exactly ONE file:
`src/core/service/visitHistoryService/v3/LastVisitCache.ts` (a bounded
key->stamp cache; only `get`/`set`). Replace it with a self-contained,
tested generic LRU and keep `LastVisitCache`'s public API unchanged.

## Acceptance criteria
- `lru-cache` removed from `package.json`/lockfile; no `fetch(` in `main.js`
  after a production build.
- `npm test`, `npm run lint` (zero errors), `npm run build` all pass;
  `LastVisitCache` behavior unchanged.
- CLAUDE.md updated (LRU-caching note + dependency list).
