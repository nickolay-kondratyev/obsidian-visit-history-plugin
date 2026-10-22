---
closed_iso: 2026-10-22T21:50:37Z
id: nid_mrd8gbvxgxbkopite8muxzrnd_e
title: "Embed inline icon: show on hover only, or always like Obsidian's own icon?"
status: closed
deps: []
links: []
created_iso: 2026-10-22T21:38:27Z
status_updated_iso: 2026-10-22T21:50:37Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [inline_note, decide]
---

**What needs deciding:** how the "Inline note" icon on a note embed should appear.

**Background:** The embed-icon ticket (`nid_1pt4xcr428953lt5qgxbmiij7_e`, closed) said to put our icon next to Obsidian's own "open link" icon and show it on hover "the same way". On the pinned Obsidian 1.12.7, the native icon (`.markdown-embed-link`) is actually ALWAYS visible (slightly faded, opacity 0.85), not hover-only. So "on hover" and "the same way as native" conflict.

**What shipped:** hover-only, as the ticket text said: our icon copies the native styling but stays hidden until you hover the embed. It is always visible on touch devices. Styling lives in `styles.css`; the decorator is in `src/editorChrome/embedInlineIcon/`.

**Options:**
- (a) Keep hover-only. Less visual noise; the destructive-ish action stays out of sight until you look for it.
- (b) Always visible, exactly like the native icon. It looks fully native, but adds a permanent icon to every singly-linked embed.

**Recommendation:** (a), keep it as is. The inline action trashes a note, so a quieter icon fits it better.

Reply with a or b; (b) is a one-line CSS change.


## Decision (owner, 2026-10-22)
(a) Keep hover-only for now. No code change.
