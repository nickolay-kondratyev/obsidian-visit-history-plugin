# F1: Refactor Service Construction — Single Instance from Plugin

> **Priority:** Medium
> **Effort:** Small (~30 min)
> **Depends on:** Phase 6 (done)

## Problem

`VaultTreemapView.getVisitedTimestamps()` reconstructs the entire dependency chain inline:

```typescript
const linkUtil = new LinkUtilDefault(this.app);
const noteFileUtil = new NoteFileUtilDefault(this.app);
const deviceNameProvider = new DeviceNameProviderDefault();
const vhFileProvider = new VHFileProvider(...);
const visitHistoryService = new VisitHistoryServiceDefault(...);
const vaultUtil = new VaultUtilDefault(...);
```

This creates duplicate instances of services that already exist in `main.ts onload()`. The `VisitHistoryService` has an LRU cache (`pathToLastVisit`) — the duplicate instance starts with a cold cache.

## Solution

Store the services as instance properties on `VisitHistoryPlugin` and expose a single method:

```typescript
// In VisitHistoryPlugin:
private vaultUtil!: VaultUtilDefault;

async onload() {
  // ...existing construction...
  this.vaultUtil = vaultUtil;
}

async getVisitedTimestamps(): Promise<Record<string, number>> {
  const trackedFiles = await this.vaultUtil.getTrackedFiles();
  const result: Record<string, number> = {};
  for (const tf of trackedFiles) {
    if (tf.timeMetadata.visitedMs !== null) {
      result[tf.file.path] = tf.timeMetadata.visitedMs.valueOf();
    }
  }
  return result;
}
```

Then in `VaultTreemapView`:
```typescript
private async refresh(): Promise<void> {
  const visitedMsMap = await this.plugin.getVisitedTimestamps();
  const data = await buildVaultTree(this.app.vault, visitedMsMap);
  this.root?.render(<TreemapApp data={data} />);
}
```

Remove the inline construction in `getVisitedTimestamps()` entirely.
