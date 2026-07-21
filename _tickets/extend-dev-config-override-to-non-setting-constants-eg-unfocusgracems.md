---
id: nid_6zyblofmn1cmqtf5yrvkbo8mp_e
title: "extend dev config override to non-setting constants (e.g. UNFOCUS_GRACE_MS)"
status: open
deps: []
links: []
created_iso: 2026-07-21T23:35:10Z
status_updated_iso: 2026-07-21T23:35:10Z
type: task
priority: 3
assignee: nickolaykondratyev
---

Follow-up to nid_xpq8zb8euhzd26bxbp6150dgt_e (ability to override config for e2e), which shipped the ConfigProvider seam + env-gated dev overrides file (__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__) but wired ONLY idleTimeoutSeconds (Pareto).

GOAL: extend the same override mechanism to reach hardcoded non-setting constants, notably UNFOCUS_GRACE_MS (src/core/focusDuration/FocusDurationTracker.ts:21), so e2e can exercise the grace-timer expiry path fast. Relates to _tickets/e2e-grace-timer-expiry-spec.md.

APPROACH: add the new key to the DevConfigOverrides shape (src/core/config/) + expose an effective getter on ConfigProvider (src/core/config/ConfigProvider.ts), route the constant read through it, and add an e2e spec. Abstraction already supports easy extension.

