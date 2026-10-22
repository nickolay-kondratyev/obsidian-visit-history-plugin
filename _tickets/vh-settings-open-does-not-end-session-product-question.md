---
closed_iso: 2026-10-22T22:31:09Z
id: nid_5psjwpcu4tnmjxy1kdjni7u97_E
title: "VH: does opening Settings intentionally NOT end the focused doc's session?"
status: closed
deps: []
links: []
created_iso: 2026-07-21T16:30:00Z
status_updated_iso: 2026-10-22T22:31:09Z
type: question
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [visit-history, product-decision, e2e]
---

Empirically confirmed against Obsidian 1.12.7 (e2e Milestone-2 probe): opening the
Settings modal does NOT change the active leaf (stays `markdown`) and does NOT blur the
OS window, so it does NOT end the focused document's session. The session ends only on
real nav to a different/untracked leaf, OS blur, idle timeout, or unload.

The S3 e2e spec (`e2e/switchToSettings.e2e.ts`) captures this CURRENT behavior (human
decision: behavior-capturing) — Settings alone records nothing; A closes on the later
switch to B.

Owner decision needed: is "Settings does not end a session" the intended semantics?
- If NO (should end/record on Settings open) → product gap; add a close trigger and
  flip the S3 spec to assert the close.
- If YES → keep current behavior; S3 stays as-is (documents the continuation).
Matches the CLAUDE.md pattern of owner-decided session semantics.

## Decision (owner, 2026-10-22)

NO — opening Settings SHOULD end the session. Implemented in
`src/core/focusDuration/WindowActivityMonitor.ts`: Settings open in a window = that window
blurred (immediate close, no grace); Settings close while the window is OS-focused = refocus
(new session). Detected via a body `childList` MutationObserver + undocumented DOM selector
`:scope > .modal-container > .modal.mod-settings` (verified on Obsidian 1.12.7). S3 spec
(`e2e/switchToSettings.e2e.ts`) flipped to assert the new behavior and guards the selector.
Judgment calls: `_agent_decisions/needs_review/settings-ends-vh-session.md`.
