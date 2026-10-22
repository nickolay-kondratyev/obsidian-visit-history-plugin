# In-memory per-note visit stats (last visit + total focus time)

Ticket: nid_xxvevkt6niwznjo3d9hpmbf6y_e

Decisions made without a human (please review):

1. **Stats aggregate ALL users and devices** — same scope as the heatmap's
   last visit. `VisitStats { lastVisitMs, totalFocusMs }`; one fold rule in
   `VisitStats` (max session START, sum of durations) used by both the disk
   read and the cache write-through.
2. **Only CLOSED sessions count.** The open session adds nothing until it ends
   (navigation away, blur, idle, unload). Sessions dropped by the min-focus
   filter leave no trace in the stats.
3. **No on-disk cache.** The stats are derivable from the `.vh_v3` files.
   Benchmark: 1000 notes x 100 visits ~ 60 ms full read on desktop; summing
   ~ 1 ms. A persisted cache would add a second source of truth for little gain.
4. **Write-sequence protocol instead of max-merge** (`VisitStatsCache`). A
   timestamp can be max-merged when a disk read races a write; a total cannot
   (it would miss or double-count the session). Rules:
   - A disk read that overlaps a session write (token taken before it, or the
     write still in flight) is returned but NOT cached; the next lookup re-reads.
   - Write-through only updates an EXISTING entry; it never creates one from a
     single session.
   - A failed append drops the doc's entry.
   Ceiling: per-doc write marks are bounded (10k LRU). If a mark may have been
   evicted, the read is conservatively not cached.
