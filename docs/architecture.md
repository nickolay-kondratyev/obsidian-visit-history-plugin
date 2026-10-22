# Architecture

## Layers

```
main.ts (Plugin lifecycle)
   │
   ▼
core/init/PluginFactory ──── DI container: constructs & wires everything once
   │
   ├── core/init ─────────── VhStartupTasks: deferred load work (V3 README
   │                         write) run via onLayoutReady
   │
   ├── core/focusTracker ─── FocusTracker listens to active-leaf-change,
   │      │                  dispatches FocusEvents to FocusListeners
   │      │                  (dispatch is SERIALIZED — events reach listeners
   │      │                  in order even when handlers await file IO;
   │      │                  tracks the focused FILE, not the leaf: unfocus is
   │      │                  dispatched whenever the file changes — incl.
   │      │                  same-leaf navigation to an untracked view)
   │      └── listener/ ──── DocIdFocusListener → ensures doc id (runs first)
   │                         VhV3FocusDurationListener → V3 duration sessions
   │
   ├── core/focusDuration ── FocusDurationTracker (V3 session state machine),
   │                         VhV3DurationRecorder (serialized store appends +
   │                         VisitStatsCache write-through),
   │                         WindowActivityMonitor (DOM boundary: window
   │                         blur/focus, visibility, user-input events)
   │
   ├── core/service ──────── VhV3DurationStore owns the .vh_v3 duration format
   │                         (append + read; VhV3SessionLineParser parses the
   │                          session line; VhV3Paths layout; VhV3ReadmeWriter
   │                          generates the in-vault format doc;
   │                          DocIdFilenameSafety validates id-as-filename)
   │                         user/: VhUserPaths (.plugin_data/visit_history/user/<user-name>/)
   │                         + UserNameProvider (prompts + pins the user name via
   │                         the UserNamePrompt modal; UserNameSafety charset)
   │                         VisitStatsProvider (read-only interface) ←
   │                         VisitHistoryServiceV3: per-note VisitStats (last
   │                         visit + total focus time; heatmap uses last visit)
   │                         (VisitStatsCache, LRU keyed by doc id)
   │                         DocIdService (stable-ids-for-obsidian): ensure
   │                         per-document id on focus — generator/stores/
   │                         service/lock live in the stable-ids-for-obsidian
   │                         npm package (its own repo)
   │                         DocIdBackfillService: vault-wide doc id backfill
   │                         migration/: VhTopDirRenameMigrationService
   │                         (.visit_history → __visit_history; runs FIRST) +
   │                         VhPluginDataMoveMigrationService (__visit_history
   │                         → .plugin_data/visit_history; runs SECOND) +
   │                         VhUserScopeMigrationService (pre-user-scoped
   │                         v2/v3 dirs → user/<user-name>/); drop the first
   │                         two + user-scope after 2026-Oct, the move after
   │                         2027-Feb
   │
   ├── core/service/inlineNote ── "Inline note (visit history aware)":
   │                         link census + placement rules (pure) behind
   │                         InlineNoteAction; ModalInlineNoteDialogs (impl/)
   │
   ├── editorChrome/embedInlineIcon ── inline-note icon on a note embed:
   │                         EmbedInlineIconRule (pure) → EmbedInlineIconDecorator
   │                         (DOM) ← reading-view post-processor + live-preview
   │                         CM6 ViewPlugin
   │
   ├── settingsTab/ ───────── VisitHistorySettingTab (Settings → Visit History):
   │                         "File modifying actions" → doc id backfill button
   │                         (ConfirmModal gate) + "Idle timeout (seconds)"
   │                         (persisted setting, live-read by the V3 tracker)
   │
   ├── core/util ─────────── NoteFileUtil (vault file I/O),
   │                         HiddenFileUtil (DataAdapter I/O for all VH data
   │                         paths — incl. legacy dot-dirs the Vault API
   │                         cannot see),
   │                         VaultUtil (tracked files), IsTrackedProvider,
   │                         DeviceNameProvider, UserNotifier
   │
   └── view/ ─────────────── VaultTreemapView (Obsidian ItemView) hosts React app
          │
          └── viewModel/ ─── buildVaultTree: TrackedFile[] → VaultNode tree
                             tileSize: tile area per sizing mode/curve
                             FileOpener: IFileOpener abstraction
```

## Key rules

- **PluginFactory is the only composition root.** All dependencies are
  constructor-injected interfaces; no service locators, no global state
  (caches are instance fields).
- **`view/VaultTreemapView.tsx` is the only file in `view/` importing
  `obsidian`.** React components receive data + callbacks as props and stay
  Obsidian-agnostic (this is why they are unit-testable).
- **Depend on interfaces** (`NoteFileUtil`, `VisitStatsProvider`,
  `IsTrackedProvider`, `IFileOpener`); `*Default` classes are the Obsidian
  implementations.

## V3 duration flow (the only recording flow)

```
active-leaf-change ──► VhV3FocusDurationListener (ensureDocId → docId
                       + hosting window via FocusEvent.ownerDocument)
window blur/focus  ──► WindowActivityMonitor ─┐   registered on EVERY window:
user input events  ──► (idle detection)       │   main at load, popouts via
                                              │   'window-open'/'window-close';
                                              │   popouts already open at load
                                              │   found via leaf enumeration
                                              ▼
                              FocusDurationTracker (state machine; a window's
                                │  Document object is its identity handle)
                                │  session CLOSES on: navigate away (10 s
                                │  grace: same-doc refocus within it continues
                                │  the session; close is stamped at the
                                │  original unfocus time), blur of
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
                              VhV3DurationRecorder (one serialized write chain;
                                │  writes each session through to
                                │  VisitStatsCache after a successful append)
                                ▼
                              VhV3DurationStore.appendFocusDuration
                                (.plugin_data/visit_history/user/<user>/v3/
                                 focus_duration_per_device/<device>/<id>.vh_v3
                                 — `<ISO start> D:<millis>`)
```

Known limitation (owner-accepted): a hard app quit can lose the last open
session (unload cannot await the write). A visit becomes visible to the
heatmap only once its session closes.

## Heatmap read flow

```
VaultTreemapView.refresh
  → VaultUtilDefault.getTrackedFiles (single vault walk)
  → VisitHistoryServiceV3.getVisitStats (VisitStatsProvider)
       (READ-ONLY DocIdService.getDocId — bulk reads never write into user
        files; VisitStatsCache hit → done)
  → VhV3DurationStore.getVisitStatsAcrossUsersAndDevices
       (VisitStats fold over ALL users' device dirs: max session START = last
        visit, sum of durations = total focus time — whole-vault activity;
        writes go to the current user only; merged-in files of inlined notes
        count towards the receiving doc)
```

## Inline note flow ("Inline note (visit history aware)")

```
file menu (.md) / command 'inline-note' on note2
  / embed icon on note1's `![[note2]]` (shown only when it is note2's ONLY
    link per metadataCache.resolvedLinks — a cheap pre-check, not the rule)
  → InlineNoteAction.run
      → InlineNotePlanner.plan (read-only; refuses with InlineRefusals)
          NoteReferenceCollector (metadataCache links/embeds/property links
            + our own canvas JSON scan) → InlineEligibility (exactly ONE
            whole-note body link in the vault, self-links ignored)
          → PlainNoteCheck (plain .md both sides) → InlinedNoteParser
          → MarkdownSectionPlacer dry run (too deep → refuse)
      → InlineNoteDialogs.confirmInline → re-plan → execute:
          FocusSessionReleaser (close + flush note2's session)
          → Vault.process(note1): MarkdownSectionPlacer + FrontmatterMerger
            (raw-text, add-only; link re-verified at its offsets)
          → ensureDocId(note1) → VhV3HistoryMerger.mergeInto(note2 → note1)
            (moves files; VisitStatsCache history-move window drops both ids)
          → FileManager.trashFile(note2)   (last — earlier failure keeps note2)
```

## Doc id flow

Every focused document gets a persistent id: `docid_{24 base36 chars}_e`
(lowercase; 36^24 ≈ 2.2e37 keeps the random space above UUID v4's 2^122).
The id machinery lives in the `stable-ids-for-obsidian` npm package (its own git
repo) so a second plugin can share it; the plugin wires it in
`PluginFactory` via `DocIdServices.createDefault(app.vault)`.

```
active-leaf-change
  → FocusTracker
  → DocIdFocusListener (registered FIRST; in-flight DROP guard per path)
  → DocIdService (stable-ids-for-obsidian; dispatch by extension)
  → CrossPluginPathLock — per-path cross-plugin window lock around the whole
       read-decide-write (registry on the versioned globalThis key
       __obsidian_id_lib_path_lock_registry_v1__, so two plugins bundling
       the lib serialize id creation; getDocId stays lock-free)
  → store
       md      → FrontmatterDocIdStore: YAML frontmatter key 'id'
                 (covers .excalidraw.md — extension is 'md')
       canvas  → CanvasDocIdStore: JSON metadata.frontmatter.id
       other   → skipped (raw .excalidraw has no id location — owner decision)
```

Rules:
- An existing id is used as-is even if it does not follow the docid_ format
  (incl. legacy uppercase base62 `docid_{21}_E` ids) — the file is then NOT
  modified (no mtime churn, no sync noise).
- An id slot occupied by an unusable value (e.g. a nested mapping) is never
  overwritten; ensure returns null.
- Empty/whitespace-only canvas content (a brand-new canvas) is treated as an
  empty canvas `{}` — an id is written on first focus (and by backfill).
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

## Startup flow (user name + legacy-layout move)

`main.ts#onload` wires only the NAME-INDEPENDENT parts of `PluginFactory`
(heatmap reads aggregate across all users; doc-id assignment is
user-agnostic) — the plugin fully loads without a user name.

On `onLayoutReady`, `main.ts` resolves the user name (`UserNameProvider`):
an already-pinned device (device-scoped localStorage, first pin wins)
resolves silently; otherwise a confirmation modal asks the human to pick an
existing `user/<name>` dir or type a new lowercase filename-safe name
(`UserNameSafety`; desktop pre-filled with the sanitized OS login name).
After the pin, `main.ts` moves any pre-user-scoped `v2`/`v3` dirs under
`user/<user-name>/` (`VhUserScopeMigrationService`) and only THEN calls
`PluginFactory.activateUserScopedRecording`, so focus tracking can never
write to the legacy location; activation also runs `VhStartupTasks`
(rewrite the generated V3 format README) and replays the last focus event
to the late-registered V3 duration listener (on the serialized dispatch
chain), so the doc already focused — restored at startup or opened while
the modal was up — still opens its session. A dismissed modal pins nothing —
no VH is recorded that session and the modal returns on the next start.


## Caching (all LRU, instance-scoped)

| Cache | Where | Why safe |
|-------|-------|----------|
| doc id → `VisitStats` (last visit + total focus time; 10k, `VisitStatsCache`) | shared by VisitHistoryServiceV3 (read) and VhV3DurationRecorder (write-through) | Write-seq protocol (see class doc): a disk read overlapping a session write is never cached; write-through merges only into an existing entry; a failed append drops the entry; refreshed on plugin reload |

Known limitation: visits synced in from another device are not seen until the
stats cache entry is evicted or the plugin reloads.

## Error philosophy

- One bad VH file must never break aggregation: session parsing
  (`VhV3SessionLineParser` via `StampLineParser`) skips unparseable lines
  instead of throwing.
- One throwing FocusListener must not block others: FocusTracker catches per
  listener and logs via `console.error`.
- Startup tasks are error-isolated: a failed README write is logged and never
  crashes plugin load.

## Legacy data

v2 focus stamps (under `.plugin_data/visit_history/v2/` or, after the
legacy-layout move, `.plugin_data/visit_history/user/<user-name>/v2/`, plus
any stranded in the interim `__visit_history/v2/`) and `_visit_history/` (V1)
are formats from older plugin versions — no longer read or written, content
left untouched (owner decision). The active top dir
`.plugin_data/visit_history/` is dot-hidden, so the Vault API never surfaces
it and it needs no tracking gate; the still-VISIBLE legacy leftovers
`__visit_history/` and `_visit_history/` are excluded from tracking via
`IsTrackedProvider`. Ancient vaults chain through two one-shot top-dir
migrations at the start of `onload`: `VhTopDirRenameMigrationService`
(`.visit_history/` → `__visit_history/`) then
`VhPluginDataMoveMigrationService` (live `.vh_v3` + README →
`.plugin_data/visit_history/`). Neither merges — if a destination already
exists the source is kept (the rename also notifies the user).
