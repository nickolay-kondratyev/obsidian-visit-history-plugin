# Visit History On-Disk Format (V3)

V3 records one COMPLETED focus session (start stamp + duration) per line.
It is the only history the plugin reads and writes.

> **Legacy data**: v2 data — wherever it sits, `.plugin_data/visit_history/v2/`
> or `.plugin_data/visit_history/user/<user-name>/v2/` (and any left stranded
> in the interim `__visit_history/v2/`) — and top-level `_visit_history/`
> (V1) are data from older plugin versions — no longer read or written; the
> content is left untouched (owner decision; the pre-user-scoped `v2` DIR is
> still moved under the user tree, see the legacy-layout section below).

## Layout

```
.plugin_data/
  visit_history/
    user/
      <user-name>/                           # one dir per user (see "User name" below)
        v3/
          README__generated__vh_v3_format.md   # generated on every load (VhV3ReadmeWriter)
          focus_duration_per_device/
            <device-name>/                     # one dir per device (hostname or mobile-XXXX)
              <doc-id>.vh_v3                   # one duration file per (device, document)
```

- **Dot-hidden on purpose**: the top dir lives under `.plugin_data/`, so
  Obsidian's file explorer and search never surface it, and plugins that
  react to visible-folder creation are not disturbed. The trade-off:
  Obsidian Sync does not sync dot-hidden folders
  (https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123/26),
  so V3 history is per-device and does NOT sync across devices — accepted as
  the lesser cost (a deliberate reversal of the earlier "visible so Sync
  syncs it" stance; the interim visible `__visit_history/` was renamed from
  the pre-2026-07 `.visit_history/` and then moved under `.plugin_data/` by
  `VhTopDirRenameMigrationService` + `VhPluginDataMoveMigrationService`).
  Because the Vault API never yields files under a dot-folder, the active top
  dir needs no `IsTrackedProvider` gate; that gate still excludes the VISIBLE
  legacy leftovers (`__visit_history/`, `_visit_history/`). All access goes
  through `HiddenFileUtil` (DataAdapter-backed; reaches dot-folders the Vault
  API can't) — see `VhUserPaths`/`VhV3Paths` for the path layout.
- **User name** (`UserNameProvider`): keeps the histories of different people
  syncing one vault apart. Chosen by the human in a confirmation modal on
  first plugin start: pick an existing `user/<name>` dir (joining that
  identity) or type a new lowercase filename-safe name (`a-z0-9._-`,
  `UserNameSafety`; desktop pre-filled with the sanitized OS login name).
  The confirmed name is pinned in device-scoped localStorage — first pin
  wins, it can never flip later. Until a name is pinned (modal dismissed),
  NO visit history is recorded and the modal returns on the next start.
- **Device name**: OS hostname on desktop; `mobile-<random8>` persisted in
  device-scoped localStorage on mobile. Must stay stable — it keys the
  directory (see `DeviceNameProvider`).
- **Per-device dirs** exist so simultaneous edits from synced devices never
  touch the same file → no sync conflicts.
- **Doc-id filenames**: the filename IS the document's persistent id
  (frontmatter `id` for md incl. `.excalidraw.md`; `metadata.frontmatter.id`
  for canvas). Ids survive renames/moves, so no backlink indirection is
  needed. Ids that are not filename-safe
  (`DocIdFilenameSafety.isFilenameSafeId`) cannot be tracked — such docs are
  skipped with a `console.error`.

## Duration file content (`VhV3DurationStore`)

```
2026-07-09T22:02:15.745Z D:5600
2026-07-09T22:14:03.001Z D:120943
```

- One COMPLETED focus session per line:
  `<ISO 8601 UTC ms stamp of focus start> D:<millis spent in focus>`,
  newline-terminated. Appended when a session ends, in session-start order
  (sessions on one device never overlap) → naturally ascending.
- A session closes on the first of: navigation away from the doc (after a
  fixed 10 s grace — a same-doc refocus within grace continues the session,
  so transient canvas-UI blips don't split it; the record is appended when
  the close FINALIZES, ≤ 10 s after the unfocus, with the end stamped at the
  unfocus moment), blur of the
  Obsidian window HOSTING it (main or popout — switching between popout
  windows closes the left-behind doc's session), the idle timeout elapsing
  without user interaction (settings → "Idle timeout (seconds)", default
  180 s, min 5 s, applied live; the recorded duration then ends at the LAST
  interaction — the idle tail is not counted), or plugin unload (best-effort
  flush; a hard app quit can lose the last open session). A tab dragged out
  to a new window keeps its session running.
- **OS sleep is never counted**: timers don't run during suspend, so the idle
  cutoff is also enforced retroactively at every session close and on the
  first post-wake interaction — a session spanning a sleep still ends at the
  last pre-sleep interaction.
- Window refocus or interaction after an idle close starts a NEW session for
  the same document.
- **Minimum focus time**: a session shorter than the "Minimum focus time
  (seconds)" setting (`minFocusSecondsToRecord`, default 2 s; 0 disables the
  filter) is dropped BEFORE the recorder (`MinDurationFilteringSink`), leaving
  NO trace at all — no `.vh_v3` line AND no heatmap last-visit bump — so quick
  in-and-out jumps into a note are not counted as visits. With the filter
  disabled (0) a zero-duration pass-through navigation is recorded truthfully
  as `D:0`; at the default it is dropped.
- Reading is strict per line (`VhV3SessionLineParser`) and never throws:
  unparseable lines are skipped, so one bad file cannot break aggregation.

## Reading (heatmap)

Last-visit for a note = max session START stamp across ALL users' device
dirs for the note's doc id (the heatmap shows whole-vault activity — owner
decision; start matches the old "stamp at focus time" semantics), resolved
via the READ-ONLY `DocIdService.getDocId` (bulk read paths must never write
ids into user files). Writes always target the CURRENT user's tree. A visit
becomes visible to the heatmap only once its session closes — accepted owner
decision.

## Legacy layouts (moved, never read)

The top dir has moved twice; ancient vaults chain through both migrations,
run in order at the start of `onload` (before user-name resolution):

1. `VhTopDirRenameMigrationService` renames the pre-2026-07 dot-hidden
   `.visit_history/` wholesale to the interim visible `__visit_history/`. If
   BOTH dirs exist (another synced device already migrated), the rename is
   skipped: `.visit_history/` is kept untouched — never merged, never
   deleted — and the user is notified of the conflict.
2. `VhPluginDataMoveMigrationService` then relocates the LIVE V3 payload
   (files ending in `.vh_v3` and the generated V3 README, preserving their
   relative path) from `__visit_history/` into `.plugin_data/visit_history/`.
   Dormant `v2/` payloads and any foreign files are LEFT behind in
   `__visit_history/` (v2 is never read). It never merges and never
   overwrites: when a destination file already exists the source is skipped.
   Cleanup prunes only empty dirs; per-file failures are logged and skipped.

Also before July 2026, version dirs lived directly under the top dir.
`VhUserScopeMigrationService` (run right after the user name is pinned,
before recording activates, relative to the current top dir
`.plugin_data/visit_history/`) moves any `<top>/v2` and `<top>/v3` under
`user/<user-name>/`, attributing legacy data to the CURRENT user. In
practice only `v3` reaches this stage — a pre-user-scoped `v2/` is not moved
by step 2, so it stays stranded in `__visit_history/v2/` and is never seen
here (acceptable; v2 is never read). The move never merges and never
deletes: if a destination dir already exists, the legacy dir is kept and an
error is logged. Such one-shot layout migrations should be cleaned up after
2026-October (rename + user-scope) / 2027-February (plugin-data move).

## Invariants

- V3 files can never be self-tracked: the active top dir
  `.plugin_data/visit_history/` is dot-hidden, so `vault.getFiles()` never
  yields files under it; the still-VISIBLE legacy leftovers
  `__visit_history/` and `_visit_history/` are excluded via
  `IsTrackedProvider`.
- Sessions in one file are ascending by start stamp; readers must still
  tolerate violations (skip bad lines, max aggregation).
