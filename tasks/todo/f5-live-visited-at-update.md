# F5: Live Update lastVisitedAt When Files Are Opened

> **Priority:** Medium
> **Effort:** Small (~20 min)
> **Depends on:** F4 (debounce), F1 (refactor services)

## Problem

The treemap only refreshes on `create`/`delete`/`rename` vault events. When a file is opened (and its `lastVisitedAt` is recorded by `VisitHistoryFocusListener`), the treemap doesn't update. The user must close and reopen the treemap to see updated visit colors.

## Solution

Add a `file-open` event listener that triggers a refresh:

```typescript
// In VaultTreemapView.onOpen():
this.registerEvent(
  this.app.workspace.on('file-open', () => this.scheduleRefresh())
);
```

This works because:
1. `file-open` fires → `FocusTracker` records the visit via `VisitHistoryFocusListener`
2. `scheduleRefresh()` debounces and rebuilds the tree
3. `VaultUtilDefault.getTrackedFiles()` reads the updated VH timestamp
4. Files that were just opened now have a recent `lastVisitedAt` → heatmap color updates

### Caveat

The `VisitHistoryService` has an LRU cache (`pathToLastVisit`). After a new visit is recorded, the cache entry for that file is updated (see `recordVisitNowOnFocus` which calls `pathToLastVisit.set(file.path, {value: nowStamp})`). So the cache is fresh for recently-opened files.

However, `getTrackedFiles()` calls `getLastVisitStamp()` for ALL tracked files, not just the one that changed. For files not in cache, it reads from disk. This is fine — the LRU cache handles the hot path.

### Interaction with F4

Use `scheduleRefresh()` (debounced) rather than `refresh()` directly. Opening multiple files in quick succession (e.g., Ctrl+Tab through tabs) should only trigger one refresh.
