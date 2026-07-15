# Heatmap filter: content-match performance on very large vaults

**Status**: OPEN (accepted v1 trade-off from `heatmap-filter-ui`, 2026-07-15)

## Problem
`ContentTermMatcherDefault` re-reads EVERY tracked file (via Obsidian's
cache-backed `cachedRead`, unbounded `Promise.all`) each time the content
term set changes — and also on every vault refresh while content terms are
active (the matching effect depends on `data` for rename-correctness).
On multi-thousand-file vaults this can take on the order of a second.

## Why accepted for v1
Term changes are rare, discrete user actions (Enter / chip remove); results
stay valid across navigation. PARETO: no index until it demonstrably hurts.

## Fix ideas
- mtime-keyed per-file result cache (invalidate on stat change).
- Chunked reads / limited concurrency instead of one big Promise.all.
- Skip re-scan on `data` changes when no tracked path set changed.
