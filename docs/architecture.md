# Architecture

## Layers

```
main.ts (Plugin lifecycle)
   │
   ▼
core/init/PluginFactory ──── DI container: constructs & wires everything once
   │
   ├── core/init ─────────── VhV2StartupTasks: deferred load work (README write,
   │                         V1→V2 migration) run via onLayoutReady
   │
   ├── core/focusTracker ─── FocusTracker listens to active-leaf-change,
   │      │                  dispatches FocusEvents to FocusListeners
   │      └── listener/ ──── DocIdFocusListener → ensures doc id (runs first)
   │                         VisitHistoryFocusListenerDefault → records visits
   │
   ├── core/service ──────── VisitHistoryServiceV2: record visit / last-visit stamp
   │                         (VhV2FocusStore owns the .vh_v2 format;
   │                          VhV2ReadmeWriter generates the in-vault format doc)
   │                         DocIdService: ensure per-document id on focus
   │                         DocIdBackfillService: vault-wide doc id backfill
   │                         migration/: VhV1ToV2MigrationService + V1FocusFileRepo
   │                         + V1FocusFileParser (legacy V1 → V2, then V1 deleted)
   │
   ├── settingsTab/ ───────── VisitHistorySettingTab (Settings → Visit History):
   │                         "File modifying actions" → doc id backfill button
   │                         (ConfirmModal gate); actions only, nothing persisted
   │
   ├── core/util ─────────── LinkUtil (wiki-link target resolution),
   │                         NoteFileUtil (vault file I/O),
   │                         HiddenFileUtil (DataAdapter I/O for dot-folders —
   │                         the Vault API cannot see `.visit_history/`),
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
  → VisitHistoryServiceV2.recordVisitNowOnFocus
       (ensureDocId → skip filename-unsafe ids;
        dedup: skip if last record went to the same doc id — keeps full
        A→B→A navigation pathways, drops same-note event bursts)
  → VhV2FocusStore.appendVisit
  → HiddenFileUtil.append (.visit_history/v2/focus_per_device/<device>/<id>.vh_v2)
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
- An id slot occupied by an unusable value (e.g. a nested mapping) is never
  overwritten; ensure returns null.
- Writes are atomic `Vault.process` transforms for both md and canvas (id
  re-checked inside the transform).
- md writes are targeted raw-text edits that only add/fill the single id
  line. WHY-NOT `FileManager.processFrontMatter`: Obsidian re-serializes the
  WHOLE frontmatter block, normalizing formatting of keys we do not own
  (e.g. `"some key": v` loses its quotes).

### Vault-wide backfill

The settings tab button "Add ids to all eligible files" runs
`DocIdBackfillService`: all tracked files → filter `DocIdService.isEligible`
(md/canvas) → the SAME `ensureDocId` path as focus. Sequential (gentle vault
I/O), per-file errors collected without aborting the run, concurrent calls
JOIN the in-flight run.

## Startup flow (V1 → V2 migration)

`main.ts` schedules `VhV2StartupTasks.run()` via `onLayoutReady` (vault index
must be complete before backlink resolution): rewrite the generated V2 format
README, then run `VhV1ToV2MigrationService.migrateIfV1Present()` — see
[visit-history-format.md](visit-history-format.md) for the exact steps and the
validation-gated permanent deletion of `_visit_history/`. After a migration,
the last-visit cache is invalidated (values cached mid-migration would be
stale).

## Caching (all LRU, instance-scoped)

| Cache | Where | Why safe |
|-------|-------|----------|
| note path → last visit stamp (10k) | VisitHistoryServiceV2 | Write-through on record; invalidated after migration; refreshed on plugin reload |

Known limitation: visits synced in from another device are not seen until the
stamp cache entry is evicted or the plugin reloads.

## Error philosophy

- One bad VH file must never break aggregation: stamp parsing
  (`StampLineParser`, `VhV2FocusStore`, `V1FocusFileParser`) skips unparseable
  lines instead of throwing.
- One throwing FocusListener must not block others: FocusTracker catches per
  listener and logs via `console.error`.
- Startup tasks are error-isolated: a failed migration notifies the user and
  never crashes plugin load; the V1 tree is only deleted after validation.
