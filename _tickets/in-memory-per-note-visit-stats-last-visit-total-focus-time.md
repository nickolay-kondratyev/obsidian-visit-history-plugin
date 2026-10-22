---
closed_iso: 2026-10-22T18:54:09Z
id: nid_xxvevkt6niwznjo3d9hpmbf6y_e
title: "In-memory per-note visit stats (last visit + total focus time)"
status: closed
deps: []
links: []
created_iso: 2026-10-22T18:45:12Z
status_updated_iso: 2026-10-22T18:54:09Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: []
---

Make total focus time per note available in memory next to last-visit, kept current as sessions are recorded. No UI surface yet (separate follow-up).

Today `src/core/service/visitHistoryService/v3/LastVisitCache.ts` caches only last-visit; `VhV3DurationStore.getLastFocusStartMsAcrossUsersAndDevices` already reads every session line (all users/devices), so summing `D:` is ~free (benchmarked: 1000 notes x 100 visits ~60 ms total read, sum ~1 ms).

Decisions (agent, see _agent_decisions/needs_review/): stats aggregate ALL users + devices (same as heatmap last-visit); only CLOSED sessions count; no on-disk cache (data is derivable).

## Acceptance Criteria

- `VisitStats { lastVisitMs, totalFocusMs }` per doc id, one aggregation rule shared by disk fold and write-through.
- Cache is race-safe: a disk read overlapping a session write never caches a stale or double-counted total.
- Recorder keeps cached stats current after each successful append.
- Unit tests cover store sum, cache protocol races, recorder write-through + failure.
- CLAUDE.md + docs/architecture.md say where the stats live.
- npm test, npm run lint, npm run build green.

