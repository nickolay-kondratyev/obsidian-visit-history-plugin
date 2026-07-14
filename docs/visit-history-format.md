# Visit History On-Disk Format (V3)

V3 records one COMPLETED focus session (start stamp + duration) per line.
It is the only history the plugin reads and writes.

> **Legacy data**: v2 data — wherever it sits, `.visit_history/v2/` or
> `.visit_history/user/<user-name>/v2/` — and top-level `_visit_history/`
> (V1) are data from older plugin versions — no longer read or written; the
> content is left untouched (owner decision; the pre-user-scoped `v2` DIR is
> still moved under the user tree, see the legacy-layout section below).

## Layout

```
.visit_history/
  user/
    <user-name>/                           # one dir per user (see "User name" below)
      v3/
        README__generated__vh_v3_format.md   # generated on every load (VhV3ReadmeWriter)
        focus_duration_per_device/
          <device-name>/                     # one dir per device (hostname or mobile-XXXX)
            <doc-id>.vh_v3                   # one duration file per (device, document)
```

- **Dot-folder on purpose**: Obsidian's Vault API and metadata cache do not
  see dot-folders, so VH files never pollute search, graph, or backlinks.
  All access goes through `HiddenFileUtil` (DataAdapter-backed) —
  see `VhUserPaths`/`VhV3Paths` for the path layout.
- **User name** (`UserNameProvider`): keeps the histories of different people
  syncing one vault apart. Resolution — first resolution wins, persisted in
  device-scoped localStorage so it can never flip later: desktop → OS account
  user name; mobile → the single existing `user/<name>` dir if exactly one
  exists, else a persisted `mobile-user-<random8>` (Obsidian mobile exposes
  no user-identity API to plugins).
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
- A session closes on the first of: navigation away from the doc, blur of the
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
  the same document. Zero-duration sessions (pass-through navigation) are
  recorded truthfully as `D:0`.
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

## Legacy pre-user-scoped layout (moved, never read)

Before July 2026, version dirs lived directly under `.visit_history/`.
`VhUserScopeMigrationService` (run early in `onload`, before focus tracking
starts) moves `.visit_history/v2` and `.visit_history/v3` under
`user/<user-name>/`, attributing legacy data to the CURRENT user. The
dormant v2 dir is moved too so it stays organized under the user tree, but
its content is never read or written. The move never merges and never
deletes: if a destination dir already exists, the legacy dir is kept and an
error is logged. Such one-shot layout migrations should be cleaned up after
2026-October.

## Invariants

- V3 files are invisible to `vault.getFiles()` (dot-folder) — they can never
  be self-tracked. Legacy `_visit_history/` stays excluded via
  `IsTrackedProvider`.
- Sessions in one file are ascending by start stamp; readers must still
  tolerate violations (skip bad lines, max aggregation).
