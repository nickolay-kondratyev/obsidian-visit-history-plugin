# Visit History On-Disk Format (V1)

## Layout

```
_visit_history/
  v1/
    focus/
      <device-name>/            # one dir per device (hostname or mobile-XXXX)
        _vh_<ulid>.md            # one VH file per (note, device)
```

- **Device name**: OS hostname on desktop; `mobile-<random8>` persisted in
  device-scoped localStorage on mobile. Must stay stable — it keys the
  directory (see `DeviceNameProvider`).
- **Per-device dirs** exist so simultaneous edits from synced devices never
  touch the same file → no sync conflicts.
- **ulid filenames**: unique, time-sortable, and independent of the note
  title (titles change; the filename never has to).

## VH file content

```
VISIT_HISTORY_V1_FOR:[[notes/target.md]]
### VISIT_HISTORY_V1:
2026-06-23T12:34:56.789Z
2026-06-24T09:01:02.345Z
```

- Line 1 embeds a **wiki backlink to the source note**. This backlink — not
  the filename — ties the VH file to its note, and Obsidian keeps it updated
  on rename/move.
- Stamps are appended, one per line, **ISO 8601 UTC with milliseconds**.
  Legacy files may contain epoch-ms integers (e.g. `1781639192842`); both
  formats parse (`FocusFile`).
- Parsing is strict (numeric or full ISO pattern) and scans from the end for
  the last valid stamp; header/comment lines are skipped, and a stamp-less
  file yields `null` rather than an error.

## Discovery

VH files for a note are found by querying Obsidian's resolved-links index for
backlinks whose path starts with `_visit_history/v1/focus/` (`VHFileProvider`):

- **Reading** (`getAllVHFocusFiles`): all devices' files — last-visit is the
  max stamp across devices.
- **Writing** (`getOrCreateVHFilePathForThisMachine`): only this device's dir,
  matched as an exact path segment (`.../focus/<device>/`) so device `mac`
  can never match `macbook-pro`. Creates the file (with header) when absent.

## Invariants

- Files under `_visit_history/` are never themselves tracked
  (`IsTrackedProvider`) — no self-tracking loops.
- More than one VH backlink per (note, device) is a user-visible warning; the
  first match is used.
