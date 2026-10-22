---
id: nid_jlkies6u31pmfft2gu3qwom96_e
title: "Lets allow merging of one note to another if there is only one link to this note (whether embedded or not regular wiki link)"
status: in_progress
deps: []
links: []
created_iso: 2026-10-22T19:39:34Z
status_updated_iso: 2026-10-22T20:39:13Z
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin/.worktree/t-jlkies6u
type: task
priority: 3
assignee: nickolaykondratyev
tags: [inline_note]
---

This refactoring option is ONLY available when there is only ONE link to the note.

And it would be named something like 'inline note (visit history aware)'

IF there was one and only one link to the note (embedded or regular)
At the end result the after running this action:
- the content of the inlined note is inlined into the target note.
- the inlined note is deleted.
- the history of the inlined is moved to so that its merged under the target note (per user).
  - we should aim to NOT modify the files and move the files only.
    - So I am thinking if note with id docid_note2_E is being inlined into docid_note1_E 
      - we would have something like tech-obsidian-vault/.plugin_data/visit_history/user/nickolaykondratyev/v3/merged_in_focus_duration_per_device/fedora-desktop/docid_note1_E/docid_note2_E.vh_v3 where instead of merging the files we just move the files. And from then on any files under merged_in_focus_duration_per_device/fedora-desktop/docid_note1_E/ would get counted towards docid_note1_E visit history (merge the histories during read). 

IF there is 0: cannot inline message pop up explaining why.
IF there is 2 or more: cannot inline message pop up explaining why. (this should include that visit history implies there is only one focused note/canvas at any point for one user so we cannot inline the visit history into multiple notes that reference this note, the message should list who refernces this note and to slim those links down).

## Clarified decisions (owner, 2026-10-22)

Naming: **note1** = the ONE note that links to **note2**. note1 receives note2's content and history; note2 is deleted afterwards.

1. **Entry point (v1)**: started FROM note2 — file context menu (explorer / tab menu) + a command for the active note. The plugin finds note1 itself.
2. **Placement + headings** — the inlined block goes RIGHT AFTER the link line, and the flow of note1 is kept:
   ~~~~
   ### Third
   See note2 for details.          <- link line (regular link → plain text)
   #### <note2 title>              <- inserted: one level below the enclosing section
   ```yaml ... ```                  <- inserted: note2's leftover properties (see 7)
   ...note2 body...                <- inserted: headings shifted under the title, relative depth kept
   #### Third-continued            <- added ONLY if loose text followed the link line
   More text of Third.
   ~~~~
   - Regular link `[[note2]]` → plain text (its alias, else note2's title). Embed `![[note2]]` → removed (its line dropped if left empty).
   - Title heading level = enclosing section level + 1; link not under any heading → `##`.
   - Continuation heading: same level as the title heading, text `<enclosing heading text>-continued` (no enclosing heading → `## <note1 title>-continued`, title picked as in 6). Only "loose" text between the link line and the next heading needs it — existing sub-headings of the section stay as they are.
   - **Link inside a list / callout / table / blockquote** (e.g. `- see [[note2]]`): the block goes after the END of that enclosing list/callout/table (never splits it); text after it gets the `-continued` heading as usual. The original link (regular or embed) becomes a same-note heading link to the new section, `[[#<note2 title>|<alias, else title>]]`, so the reference still leads to the moved content.
   - **Too deep** (any shifted heading would pass `######`) → refuse. The message says why and what to do: move the link higher up the heading chain in note1, then retry.
3. **Partial links** (`[[note2#Heading]]`, `![[note2#^block]]`): refuse with a message.
4. **"Exactly one link"** = one link in the WHOLE vault: body links, embeds, frontmatter property links, AND canvas references (file cards + links in canvas text cards). Self-links inside note2 are ignored. Two links from the same file = 2 → refuse. Single link inside a property → refuse.
   - 0 links → refuse, explaining why. 2+ → refuse; message explains visit history assumes one focused note at a time per user (history can't be split across several notes), lists each referencing file + its link count, and asks to slim the links down to one.
   - Obsidian's `metadataCache` does not cover canvases — canvas JSON must be scanned by us so a canvas link is never broken.
5. **File types**: only plain `.md` → plain `.md`. Refuse if either side is a canvas or Excalidraw drawing (canvases still COUNT in the link check, see 4).
6. **Title** of the inlined section: frontmatter `title` > first `# H1` > file name (no `.md`). If note2's body STARTS with a `# H1` equal to the chosen title, that H1 is dropped (no duplicate title).
7. **note2's frontmatter**:
   - `id` → dropped. `title` → consumed as the section title (6).
   - Tag properties (empty-value flag keys, e.g. `locations:` marking "this note has locations") → added to note1's frontmatter if note1 lacks them.
   - `tags` → merged into note1's `tags` (union, no duplicates).
   - `aliases` → merged into note1's `aliases` (union, no duplicates; Obsidian accepts a string or a list — normalize to a list) AND kept in the yaml block.
   - All other properties → kept as a fenced `yaml` block right under the title heading, before note2's body.
   - note1 frontmatter edits are raw-text edits that only add keys/values — never `processFrontMatter` (it re-serializes and mangles keys we don't own; see CLAUDE.md "Doc ids").
8. **Confirm + delete**: confirm dialog before running; note2 goes to the trash the normal Obsidian way (`FileManager.trashFile`, respects the user's "Deleted files" setting). The dialog states that restoring note2 from the trash does NOT bring its visit history back. Editor undo (Ctrl+Z in note1) is NOT a concern — no special handling.
9. **Other devices**: accepted — `.plugin_data/` does not sync, so only history present on THIS device is moved; other devices keep note2's history unattached (invisible dead data). Every user's note2 files found locally are moved, each staying under its own `user/<name>/` dir.
10. **Chains**: flatten — when note1 (which already holds merged-in history) is itself inlined into note0, note1's own files AND its merged-in files all move under `merged_in_focus_duration_per_device/<device>/<note0-id>/`. Merges are always one level deep.

### Assumptions (stated to owner, not objected to)
- note1 stats after merge: last visit = latest across own + merged sessions; total time = sum.
- If note2 has an open focus session, it is closed BEFORE the move (no line lands at the old path).
- note1 gets a doc id if it has none.
- Merged-file name collision (e.g. note2 restored from trash and inlined again) → numbered suffix (`<note2-id>__2.vh_v3`); nothing lost, still counted.
- note1's `VisitStatsCache` entry is refreshed so the heatmap updates right away.
- Read cost: one extra folder listing per note per device on heatmap reads — ceiling noted in code.
- Headings inside fenced code blocks are NOT shifted.
- Heading link collision (note1 already has a heading with the same text as note2's title): use Obsidian's nested heading-link form `[[#<enclosing heading>#<note2 title>]]` so the link resolves to the new section, not the older one.
- `docs/visit-history-format.md` + generated V3 README document the `merged_in_focus_duration_per_device/` dir.
