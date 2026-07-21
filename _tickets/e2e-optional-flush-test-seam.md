---
id: nid_d6al1divzofj2x59q769fqll9_E
title: "e2e: optional synchronous flush test-seam to remove append polling"
status: open
deps: []
links: []
created_iso: 2026-07-21T16:30:00Z
status_updated_iso: 2026-07-21T16:30:00Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, visit-history]
---

The e2e specs currently poll the `.vh_v3` files (bounded, never a fixed sleep) because
there is no DOM-reachable synchronous "flush now" hook. A tiny test-support seam
(e.g. an awaitable flush on the recorder's write chain exposed for tests) would let specs
await the append deterministically instead of polling.

Low priority — bounded polling already works reliably. Only worth it if flakiness ever
appears. Would require a runtime seam (flag it for review; keep the plugin's public
surface clean).
