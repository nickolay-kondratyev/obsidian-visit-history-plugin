---
id: nid_1pt4xcr428953lt5qgxbmiij7_e
title: "Inline icon on a note embed that is the note's only link in the vault"
status: open
deps: [nid_jlkies6u31pmfft2gu3qwom96_e]
links: [nid_jlkies6u31pmfft2gu3qwom96_e]
created_iso: 2026-10-22T20:11:58Z
status_updated_iso: 2026-10-22T20:11:58Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [inline_note]
---

## Goal
Make the "Inline note (visit history aware)" action (ticket `nid_jlkies6u31pmfft2gu3qwom96_e`) one click away where it is most natural: on the embed itself. When note1 shows `![[note2]]` and that embed is note2's ONLY link in the vault, an "inline" icon appears on the embed; clicking it runs the same action (confirm dialog → inline → history moved → note2 trashed). Owner request, 2026-10-22.

## Done criteria
- In BOTH reading view and live preview, a whole-note embed `![[note2]]` of a plain `.md` note shows an inline icon (lucide-style, matching Obsidian's embed chrome; tooltip in sentence case, e.g. "Inline note into this note") when note2's link count is exactly 1.
- **Placement** (owner decision): right beside Obsidian's built-in "open link" icon in the embed's top-right corner, and shown ON HOVER the same way — it must look like part of the native embed chrome. Independent of the foldable-embedded-notes plugin being installed. (The native icon's class is believed to be `.markdown-embed-link` — UNVERIFIED; confirm in DevTools on the pinned e2e Obsidian before relying on it.)
- No icon when: note2 has 0 or 2+ links; the embed is partial (`![[note2#Heading]]`, `![[note2#^block]]`); the embed is not a plain `.md` note (image, PDF, canvas, Excalidraw…); the embed is nested inside another embed.
- Clicking the icon runs the SAME action/service as the note2 context-menu entry — every refusal and the confirm dialog behave identically (no parallel implementation).
- The icon updates without reload when links change (e.g. adding a second link to note2 elsewhere hides it on next render).
- Injected DOM and observers are cleaned up on plugin unload (no leftover icons; `registerEditorExtension` / `registerMarkdownPostProcessor` lifecycle).
- Unit tests for the pure "should the icon show for this embed" decision (link count, partial, file type, nested); one e2e spec (`npm run test:e2e`) that clicks the icon in live preview and asserts note2 is gone and note1 holds its content.

## Context
- Action, link-count rules, and refusals: `_tickets/lets-allow-merging-of-one-note-to-another-if-there-is-only-one-link-to-this-note-whether-embedded-or-not-regular-wiki-linkm.md` (decisions 2–5, 8).
- No public Obsidian API decorates note embeds. Proven pattern in the owner's own plugin `obsidian-foldable-embedded-notes` (github.com/nickolay-kondratyev/obsidian-foldable-embedded-notes — see its CLAUDE.md, `src/embedFoldDom.ts`, `src/livePreview/livePreviewFoldExtension.ts`):
  - reading view: markdown post-processor + `MutationObserver` waiting for `.markdown-embed` / `.markdown-embed-title`, cleanup via `MarkdownRenderChild`;
  - live preview: CM6 `ViewPlugin` querying `.internal-embed` on `view.contentDOM`, driven by a `childList` `MutationObserver`, a wired-set to avoid double-injection, removal in `destroy()`, nested embeds excluded.
- `src/` uses none of `registerMarkdownPostProcessor`, `registerEditorExtension`, CodeMirror, or `MutationObserver` today — this is the first.
- `view/` rule (CLAUDE.md): only `VaultTreemapView.tsx` imports `obsidian` there — put this embed UI outside `view/` (it is editor chrome, not the heatmap).

## Constraints
- **Cheap visibility check**: decide icon visibility from `app.metadataCache.resolvedLinks` only (cheap, per render). Do NOT scan canvas JSON on every render. Canvas references are checked by the action's full link count on click, so a canvas-only extra link shows the icon but the click refuses with the normal "2+ links" message — accepted ceiling (rare; upgrade path: a canvas-link index). Name this ceiling in a code comment.
- Never let a throw escape the CM6 `ViewPlugin` (an uncaught throw deactivates it — e.g. `posAtDOM` mid-render); catch + `console.error`.

## Non-goals
- No icon on regular (non-embed) links — the context menu / command on note2 cover those.
- No inline icon on canvas cards.
- No new rules for when inlining is allowed — this ticket only adds an entry point.
