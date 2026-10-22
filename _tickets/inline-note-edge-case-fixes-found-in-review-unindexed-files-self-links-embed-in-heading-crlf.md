---
id: nid_g093hvhy7cn5bfyigkjhdp9w7_e
title: "Inline note: edge-case fixes found in review (unindexed files, self-links, embed in heading, CRLF)"
status: open
deps: []
links: []
created_iso: 2026-10-22T21:14:32Z
status_updated_iso: 2026-10-22T21:14:32Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [inline_note]
---

Follow-up to the merged "Inline note (visit history aware)" action (ticket `nid_jlkies6u31pmfft2gu3qwom96_e`; code in `src/core/service/inlineNote/`). Four edge cases the review found; none are covered by the original ticket.

## Done criteria
1. **Unindexed files never break a link.** Today a markdown file without a `metadataCache` entry yet (e.g. right after startup) is skipped by the link census (`NoteReferenceCollector`), so a link from it can be missed and then broken when note2 is trashed. Fix: if any `.md` file in the vault has no cache entry, refuse with a plain message ("Obsidian is still indexing your vault — try again in a moment"), like the existing stale-index refusal. No guessing.
2. **note2's links to itself keep working.** Links inside note2 that point to note2 (`[[note2#X]]`, `[[note2#^block]]`, `[[note2]]`) are rewritten in the inlined body: `[[note2#X]]` → `[[#X]]` (keep alias/display text), `[[note2#^b]]` → `[[#^b]]`, bare `[[note2]]` → the same heading link the original link gets (`[[#<note2 title>|…]]`). Embeds of note2 inside note2 follow the same mapping. (Self-links are already ignored by the link count — keep that.)
3. **Embed inside a heading line** (`### ![[note2]]`, also a regular link in a heading): refuse with a message saying to move the link out of the heading line, then retry. Today it leaves an empty `### ` heading plus a stray `-continued` heading.
4. **CRLF notes stay CRLF.** Inserted lines use note1's existing line ending (detect from note1 content), so line endings are never mixed.

Each point gets unit tests (BDD, one behavior per test) in the mirrored test files. No new e2e spec needed.

## Non-goals
- Canvas / raw `.excalidraw` scanning changes (ceilings already noted in code).

