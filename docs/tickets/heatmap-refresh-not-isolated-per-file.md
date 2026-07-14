# Heatmap refresh dies on a single failed read

`VaultUtilDefault.getTrackedFiles` (src/core/util/vault/VaultUtil.ts) uses
`Promise.all` over per-file `getLastVisitStamp` lookups with no per-file error
isolation: one transient `DataAdapter.read`/`list` rejection aborts the entire
treemap render.

Pre-existing behavior (identical under the removed V2 path) — flagged during
the V2-removal review, explicitly not a regression.

**Fix idea**: catch per file and degrade that file to `visitedMs: null`
(+ `console.error`), matching the repo-wide "one bad file can't break
aggregation" rule.
