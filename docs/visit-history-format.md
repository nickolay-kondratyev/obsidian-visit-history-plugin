# Visit History On-Disk Format (V2 + V3)

V2 (focus stamps) is the MAIN history. V3 (focus DURATIONS) is recorded
alongside it — both are written live, independently.

## Layout

```
.visit_history/
  user/
    <user-name>/                           # one dir per user (see "User name" below)
      v2/
        README__generated__vh_v2_format.md   # generated on every load (VhV2ReadmeWriter)
        focus_per_device/
          <device-name>/                     # one dir per device (hostname or mobile-XXXX)
            <doc-id>.vh_v2                   # one focus file per (device, document)
      v3/
        README__generated__vh_v3_format.md   # generated on every load (VhV3ReadmeWriter)
        focus_duration_per_device/
          <device-name>/
            <doc-id>.vh_v3                   # one duration file per (device, document)
```

- **Dot-folder on purpose**: Obsidian's Vault API and metadata cache do not
  see dot-folders, so V2 files never pollute search, graph, or backlinks.
  All access goes through `HiddenFileUtil` (DataAdapter-backed) —
  see `VhUserPaths`/`VhV2Paths`/`VhV3Paths` for the path layout.
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
  (`DocIdFilenameSafety.isFilenameSafeId`, shared by V2 and V3) cannot be
  tracked — such docs are skipped with a `console.error`.

## Focus file content (`VhV2FocusStore`)

```
2026-06-23T12:34:56.789Z
2026-06-24T09:01:02.345Z
```

- One stamp per line — **ISO 8601 UTC with milliseconds** — newline-terminated,
  sorted ascending, without exact duplicates.
- Live recording appends; only migration rewrites whole files (normalizing to
  the invariants above).
- Reading is strict per line and never throws: unparseable lines are skipped,
  so one bad file cannot break aggregation.

## V3 duration file content (`VhV3DurationStore`)

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

## Reading (heatmap)

Last-visit for a note = max stamp across ALL users' device dirs for the
note's doc id (the heatmap shows whole-vault activity — owner decision),
resolved via the READ-ONLY `DocIdService.getDocId` (bulk read paths must
never write ids into user files).

## Legacy pre-user-scoped layout (migration input only)

Before July 2026, `v2/` and `v3/` lived directly under `.visit_history/`.
`VhUserScopeMigrationService` (run early in `onload`, before focus tracking
starts) moves each under `user/<user-name>/`, attributing legacy data to the
CURRENT user. It never merges and never deletes: if a destination dir already
exists, the legacy dir is kept and an error is logged. Such one-shot layout
migrations should be cleaned up after 2026-October.

## Legacy V1 format (migration input only)

V1 lived under `_visit_history/v1/focus/<device>/_vh_<ulid>.md` (a visible
folder), tying each file to its note via a `VISIT_HISTORY_V1_FOR:[[...]]`
backlink line, with ISO or legacy epoch-ms stamp lines. `V1FocusFileParser`
still parses this — solely as input for migration.

### Auto migration V1 → V2 (`VhV1ToV2MigrationService`)

Runs once per load (from `VhStartupTasks`, onLayoutReady) when
`_visit_history/` exists:

1. Vault-wide doc id backfill (V2 is keyed by doc id).
2. Parse every V1 focus file; resolve its backlink to the note and the note's
   id; group stamps per (device, doc id).
3. Merge into V2 files — union with any existing V2 stamps, sorted + deduped.
4. Validate: every V1 stamp must be readable back from V2.
5. All valid → **permanently delete** the whole `_visit_history/` tree,
   including unmigratable files (missing/unresolvable backlink, doc without a
   usable id) — owner decision; each is logged via `console.error` and the
   count is surfaced in the completion Notice. Any validation failure →
   delete nothing and show an error Notice.

## Invariants

- V2 files are invisible to `vault.getFiles()` (dot-folder) — they can never
  be self-tracked. Legacy `_visit_history/` stays excluded via
  `IsTrackedProvider` until migration removes it.
- Stamps in one focus file are unique and ascending; readers must still
  tolerate violations (skip bad lines, `Math.max` aggregation).
