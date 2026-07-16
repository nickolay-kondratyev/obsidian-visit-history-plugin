# Canvas ensureId return asymmetry under concurrent write

**Status**: OPEN (pre-existing; surfaced during `extract-id-lib` review, 2026-07-16)

## Context
In the canvas store, if the in-transform re-check finds an id that appeared between the
fast-path read and the write (a concurrent writer won), `ensureDocId` keeps the file's
id (correct) but can RETURN the locally generated id instead of the one kept on disk.
Md frontmatter path does not have this asymmetry. Pre-existing behavior, moved verbatim
into `submodules/obsidian-id-lib`; the new CrossPluginPathLock makes the window tiny
(only a non-lib-using third plugin could race).

## Task
In the lib: make canvas `ensureDocId` return the id actually persisted (re-check result),
mirroring the md store. Start with a failing test.
