---
id: nid_hswj7g18v1h9h5hez790da7z3_E
title: "e2e: dedicated 10s grace-timer-expiry spec (uncovered path)"
status: open
deps: []
links: []
created_iso: 2026-07-21T16:30:00Z
status_updated_iso: 2026-07-21T16:30:00Z
type: test
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, visit-history]
---

None of the 5 core e2e specs exercise the `UNFOCUS_GRACE_MS` (10s) grace-timer EXPIRY
path: switching to a DIFFERENT tracked doc finalizes the pending close immediately
(`FocusDurationTracker.finalizePendingClose`), so the switch specs never wait out the
grace. The idle spec has no grace.

Add a spec that unfocuses a doc WITHOUT switching to another tracked doc (e.g. switch to
an empty/untracked leaf, or blur the hosting window) then waits out the 10s grace to
prove: (a) the grace-expiry close (stamped at the original unfocus moment), and (b) a
same-doc refocus WITHIN the grace cancels the close and continues the session. Low
priority; the 5 required scenarios stand as-is.

I am thinking for this one we will want to have an override of settings, like test-override.json file that contains the override, and we can pass this file through an environment variable. If this environment variable is set the plugin will read the overrides and use those overrides. With that said we will want to well abstract this interaction so its focused and usages of this file are not spread out. The usage of this override should be in one place. Behind something like `SettingReader`. 