# Architecture

## Layers

```
main.ts (Plugin lifecycle)
   │
   ▼
core/init/PluginFactory ──── DI container: constructs & wires everything once
   │
   ├── core/focusTracker ─── FocusTracker listens to active-leaf-change,
   │      │                  dispatches FocusEvents to FocusListeners
   │      └── listener/ ──── VisitHistoryFocusListenerDefault → records visits
   │                         VHFileProvider → finds/creates VH files
   │
   ├── core/service ──────── VisitHistoryService: record visit / last-visit stamp
   │
   ├── core/util ─────────── LinkUtil (backlinks), NoteFileUtil (vault file I/O),
   │                         VaultUtil (tracked files), IsTrackedProvider,
   │                         DeviceNameProvider, UserNotifier
   │
   └── view/ ─────────────── VaultTreemapView (Obsidian ItemView) hosts React app
          │
          └── viewModel/ ─── buildVaultTree: TrackedFile[] → VaultNode tree
                             FileOpener: IFileOpener abstraction
```

## Key rules

- **PluginFactory is the only composition root.** All dependencies are
  constructor-injected interfaces; no service locators, no global state
  (caches are instance fields).
- **`view/VaultTreemapView.tsx` is the only file in `view/` importing
  `obsidian`.** React components receive data + callbacks as props and stay
  Obsidian-agnostic (this is why they are unit-testable).
- **Depend on interfaces** (`LinkUtil`, `NoteFileUtil`, `VisitHistoryService`,
  `IsTrackedProvider`, `IFileOpener`); `*Default` classes are the Obsidian
  implementations.

## Recording flow

```
active-leaf-change
  → FocusTracker (filters via IsTrackedProvider, isolates listener errors)
  → VisitHistoryFocusListenerDefault (in-flight DROP guard per note path)
  → VisitHistoryService.recordVisitNowOnFocus
       (dedup: skip if last record went to the same VH file — keeps full
        A→B→A navigation pathways, drops same-note event bursts)
  → VHFileProvider.getOrCreateVHFilePathForThisMachine
  → NoteFileUtil.appendLineToNote (atomic vault.process)
```

## Caching (all LRU, instance-scoped)

| Cache | Where | Why safe |
|-------|-------|----------|
| note path → created VH path (500, 1 min TTL) | VHFileProvider | Only self-created ulid paths — backlink-resolved paths are never cached (user may move them) |
| note path → last visit stamp (10k) | VisitHistoryService | Write-through on record; refreshed on plugin reload |

Known limitation: visits synced in from another device are not seen until the
stamp cache entry is evicted or the plugin reloads.

## Error philosophy

- One bad VH file must never break aggregation: `FocusFile.getLastStamp`
  returns `null` for unparseable content instead of throwing.
- One throwing FocusListener must not block others: FocusTracker catches per
  listener and logs via `console.error`.
