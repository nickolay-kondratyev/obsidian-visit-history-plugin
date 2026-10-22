# Opening Settings ends the VH session

Ticket: nid_5psjwpcu4tnmjxy1kdjni7u97_E (owner decided: Settings SHOULD stop the session).
Code: `src/core/focusDuration/WindowActivityMonitor.ts`.

Judgment calls (please review):

1. **Settings = window blur, no grace.** Opening Settings in window W calls
   `tracker.onWindowBlurred(W)`: the session closes at once. A quick settings
   peek therefore SPLITS the session into two lines (accepted). Closing
   Settings re-opens a NEW session only if W is OS-focused (`hasFocus()`).
   A window `focus` / visible `visibilitychange` while Settings is still open
   does NOT re-open (alt-tab away and back with Settings up).
2. **Settings only, not all modals.** Command palette / quick switcher /
   other modals are part of working on the note; only Settings is "leaving".
3. **Detection via undocumented DOM.** Obsidian has no public Settings
   open/close event. A per-window `MutationObserver` on `<body>` (`childList`
   only — no subtree, cheap) checks
   `:scope > .modal-container > .modal.mod-settings` (verified on Obsidian
   1.12.7 via the e2e harness). `app.setting` is NOT monkey-patched.
   **Ceiling:** if Obsidian renames those classes, detection silently degrades
   to the old behavior (Settings does not end the session).
   `e2e/switchToSettings.e2e.ts` guards this — re-run on Obsidian bumps.
4. **Plugin enabled from inside Settings:** the Settings modal is already open
   at registration, so no session opens until Settings closes (consistent with
   rule 1).
5. **Window-blur e2e is synthetic.** Headless Electron does not deliver a real
   OS blur (`BrowserWindow.blur()` fires no DOM `blur`, `hasFocus()` stays true),
   so `e2e/windowBlur.e2e.ts` dispatches a synthetic `blur`/`focus` event. It
   proves the wiring inside real Obsidian, not the OS signal.
