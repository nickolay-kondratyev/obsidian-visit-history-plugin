# F4: Debounce Vault Refresh for Large Vaults

> **Priority:** Medium
> **Effort:** Small (~20 min)
> **Depends on:** Phase 6 (integration done)

## Problem

`VaultTreemapView.onOpen()` registers listeners on `create`, `delete`, and `rename` vault events. Each triggers `refresh()` which:
1. Calls `VaultUtilDefault.getTrackedFiles()` (scans all files + visits all VH backlinks)
2. Calls `buildVaultTree()` (walks all vault files, builds nested tree)
3. Re-renders the entire React tree

For large vaults (1000+ files), this is expensive. Rapid file operations (e.g., batch rename, template expansion) could trigger many refreshes in quick succession.

## Solution

Debounce the refresh callback:

```typescript
private refreshTimer: number | null = null;
private readonly REFRESH_DEBOUNCE_MS = 500;

private scheduleRefresh(): void {
  if (this.refreshTimer !== null) {
    window.clearTimeout(this.refreshTimer);
  }
  this.refreshTimer = window.setTimeout(() => {
    this.refreshTimer = null;
    this.refresh();
  }, this.REFRESH_DEBOUNCE_MS);
}
```

Use `scheduleRefresh()` instead of `refresh()` in vault event handlers:

```typescript
this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
this.registerEvent(this.app.vault.on('rename', () => this.scheduleRefresh()));
```

Also add a refresh on `file-open` to update `lastVisitedAt` in real time (see F5).

### Performance Note

Debouncing helps but doesn't fix the underlying O(n) cost. For vaults > 5000 files, consider:
- Caching the tree structure and only updating changed paths
- Using a `Map<string, VaultNode>` for O(1) path lookups during tree construction
- Web Worker for tree building (off-main-thread)

These are **follow-up optimizations** — not needed for MVP.
