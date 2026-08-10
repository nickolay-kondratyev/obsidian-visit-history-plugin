---
closed_iso: 2026-08-10T18:10:56Z
id: nid_kmnk1sasm5itvw3twkxj6wja4_e
title: Investigate the network call
status: closed
deps: []
links: []
created_iso: '2026-08-10T18:07:37Z'
status_updated_iso: 2026-08-10T18:10:56Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin
---
The obsidian score card showed that there is a network call:
```
Number of network request calls
All network requests should be necessary and disclosed to users.
1 network call
```

Investigate where this network call is coming from.

## Resolution — FALSE POSITIVE (no real network call)

**The plugin makes NO network calls.** The scorecard's static analyzer counts the
literal token `fetch(` in the bundled `main.js` and reports it as a "network request".

### Findings

- Our own source (`src/`) contains **zero** network primitives — no `fetch`,
  `XMLHttpRequest`, `WebSocket`, `requestUrl`, `sendBeacon`, `navigator.*`, or
  external `<img src>`. Only match was a **comment URL** in
  `src/core/service/visitHistoryService/user/VhUserPaths.ts:22` (an Obsidian
  forum link explaining why `__visit_history` is not dot-hidden).
- `main.js` contains exactly **2** occurrences of `fetch(`, both from the
  **`lru-cache`** dependency: its public `LRUCache.fetch()` method and the
  private `#fetch()` helper (`node_modules/lru-cache/dist/commonjs/index.js:1340`).
  These are **cache-fill / memoization** methods — they invoke a user-supplied
  `fetchMethod`, NOT `window.fetch` / HTTP. See the lru-cache "fetch" docs.
- We use `lru-cache` only in
  `src/core/service/visitHistoryService/v3/LastVisitCache.ts` and call **only
  `.get()` / `.set()`** — the `.fetch()` method is never invoked. It is present
  in the bundle simply because it is a method on the imported `LRUCache` class
  (class methods are not tree-shaken).
- Other flagged tokens are all benign: `.src=` at main.js:13 is React's DOM
  reconciler setting an `<img>` element's `src` property; the only `https?://`
  URLs in the bundle are standard XML/SVG/MathML namespaces
  (`www.w3.org/...`), React's error-decoder docs URL, and `fb.me/use-check-prop-types`.

### Conclusion

The "1 network call" is a **false positive** originating from the `lru-cache`
dependency's `fetch()` method name. The plugin remains fully offline/local.

### Remediation options (owner decision — not done here; investigation-only ticket)

To make the scorecard report 0 network calls, the `lru-cache` dependency would
have to be removed. `LastVisitCache` only needs a bounded LRU keyed by doc id
with `get`/`set` — a small self-contained LRU (Map-based, insertion-order
eviction) would drop the dependency and eliminate the false-positive token, at
the cost of ~20 lines of maintained code. Recommend a follow-up ticket if the
owner wants a clean scorecard; the current behavior is correct and safe.
