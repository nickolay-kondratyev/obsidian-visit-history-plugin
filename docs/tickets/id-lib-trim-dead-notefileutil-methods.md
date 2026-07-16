# Trim production-dead NoteFileUtil methods after id-lib extraction

**Status**: OPEN (follow-up from `extract-id-lib`, 2026-07-16)

## Context
Doc-id stores moved to `submodules/obsidian-id-lib` with their own `FileContentAccess`
seam, leaving `NoteFileUtil.process` with no production caller in the plugin.

## Task
Audit `NoteFileUtil` (`process`, and while there `createNote`/`appendLineToNote`) for
production-dead methods and remove them plus their fake/test surface. Delete unused
code completely — no compatibility shims.
