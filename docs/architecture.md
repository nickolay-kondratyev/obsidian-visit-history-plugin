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
   │      └── listener/ ──── DocIdFocusListener → ensures doc id (runs first)
   │                         VisitHistoryFocusListenerDefault → records visits
   │                         VHFileProvider → finds/creates VH files
   │
   ├── core/service ──────── VisitHistoryService: record visit / last-visit stamp
   │                         DocIdService: ensure per-document id on focus
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

## Doc id flow

Every focused document gets a persistent id: `docid_{21 base62 chars}_E`.

```
active-leaf-change
  → FocusTracker
  → DocIdFocusListener (registered FIRST; in-flight DROP guard per path)
  → DocIdService (dispatch by extension)
       md      → FrontmatterDocIdStore: YAML frontmatter key 'id'
                 (covers .excalidraw.md — extension is 'md')
       canvas  → CanvasDocIdStore: JSON metadata.frontmatter.id
       other   → skipped (raw .excalidraw has no id location — owner decision)
```

Rules:
- An existing id is used as-is even if it does not follow the docid_ format —
  the file is then NOT modified (no mtime churn, no sync noise).
- An id slot occupied by an unusable value (e.g. an object) is never
  overwritten; ensure returns null.
- Writes are atomic: `FileManager.processFrontMatter` for md,
  `Vault.process` for canvas (id re-checked inside the transform).

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
