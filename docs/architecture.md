# Architecture

## Layers

```
main.ts (Plugin lifecycle)
   │
   ▼
core/init/PluginFactory ──── DI container: constructs & wires everything once
   │
   ├── core/init ─────────── VhStartupTasks: deferred load work (V2 + V3 README
   │                         writes, V1→V2 migration) run via onLayoutReady
   │
   ├── core/focusTracker ─── FocusTracker listens to active-leaf-change,
   │      │                  dispatches FocusEvents to FocusListeners
   │      │                  (dispatch is SERIALIZED — events reach listeners
   │      │                  in order even when handlers await file IO)
   │      └── listener/ ──── DocIdFocusListener → ensures doc id (runs first)
   │                         VisitHistoryFocusListenerDefault → records V2 visits
   │                         VhV3FocusDurationListener → V3 duration sessions
   │
   ├── core/focusDuration ── FocusDurationTracker (V3 session state machine),
   │                         VhV3DurationRecorder (serialized store appends),
   │                         WindowActivityMonitor (DOM boundary: window
   │                         blur/focus, visibility, user-input events)
   │
   ├── core/service ──────── VisitHistoryServiceV2: record visit / last-visit stamp
   │                         (VhV2FocusStore owns the .vh_v2 format;
   │                          VhV2ReadmeWriter generates the in-vault format doc)
   │                         VhV3DurationStore owns the .vh_v3 duration format
   │                         (+ VhV3Paths, VhV3ReadmeWriter;
   │                          DocIdFilenameSafety shared by V2 + V3)
   │                         DocIdService: ensure per-document id on focus
   │                         DocIdBackfillService: vault-wide doc id backfill
   │                         migration/: VhV1ToV2MigrationService + V1FocusFileRepo
   │                         + V1FocusFileParser (legacy V1 → V2, then V1 deleted)
   │
   ├── settingsTab/ ───────── VisitHistorySettingTab (Settings → Visit History):
   │                         "File modifying actions" → doc id backfill button
   │                         (ConfirmModal gate) + "Idle timeout (seconds)"
   │                         (persisted setting, live-read by the V3 tracker)
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

## V3 duration flow (recorded ALONGSIDE V2 — V2 stays the main history)

```
active-leaf-change ──► VhV3FocusDurationListener (ensureDocId → docId
                       + hosting window via FocusEvent.ownerDocument)
window blur/focus  ──► WindowActivityMonitor ─┐   registered on EVERY window:
user input events  ──► (idle detection)       │   main at load, popouts via
                                              │   'window-open'/'window-close'
                                              ▼
                              FocusDurationTracker (state machine; a window's
                                │  Document object is its identity handle)
                                │  session CLOSES on: navigate away, blur of
                                │  the window HOSTING the doc (incl. popout →
                                │  popout switches), idle timeout (setting,
                                │  default 180 s, live-read; duration then
                                │  ends at the LAST interaction; also enforced
                                │  retroactively — OS sleep never counts), or
                                │  plugin unload flush; refocusing the doc's
                                │  window / interaction after idle opens a NEW
                                │  session; a tab DRAGGED to another window
                                │  keeps its session
                                ▼
                              VhV3DurationRecorder (one serialized write chain)
                                ▼
                              VhV3DurationStore.appendFocusDuration
                                (.visit_history/v3/focus_duration_per_device/
                                 <device>/<id>.vh_v3 — `<ISO start> D:<millis>`)
```

Known limitation (owner-accepted): a hard app quit can lose the last open
session (unload cannot await the write).

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

`main.ts` schedules `VhStartupTasks.run()` via `onLayoutReady` (vault index
must be complete before backlink resolution): rewrite the generated V2 and V3
format READMEs, then run `VhV1ToV2MigrationService.migrateIfV1Present()` — see
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
