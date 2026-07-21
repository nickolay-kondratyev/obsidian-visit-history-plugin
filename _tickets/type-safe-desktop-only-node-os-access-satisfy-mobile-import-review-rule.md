---
id: nid_md230p48n14ygqj6bht2co638_E
title: "Type-safe desktop-only Node 'os' access + satisfy mobile-import review rule"
status: open
deps: []
links: []
created_iso: 2026-07-21T01:06:01Z
status_updated_iso: 2026-07-21T01:06:01Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, typescript, obsidian-mobile, type-safety]
---

Two files read the Node `os` builtin (desktop/Electron only, guarded by `Platform.isDesktopApp` + try/catch). Two overlapping review findings on the same lines:

1) obsidianmd mobile rule: "Do not import Node.js built-in module 'os'. Use a dynamic import() or require() guarded by Platform.isDesktop instead." at:
   - src/core/service/visitHistoryService/user/UserNameProvider.ts:39
   - src/core/util/env/DeviceNameProvider.ts:43
2) @typescript-eslint/no-unsafe-call / -member-access on the SAME lines: `require("os")` returns `any` (`no-undef` is disabled for require), so calling it is an unsafe-call and the subsequent `.userInfo()/.hostname()` chain is unsafe-member-access.

Current code (both files) already guards with `if (!Platform.isDesktopApp) return null;` then `(require("os") as {...}).xxx()` under an eslint-disable line. The disables suppress LOCAL lint but the external review tool still flags, and the `as`-cast still leaves the `require(...)` CALL itself unsafe.

FIX DIRECTION: replace the untyped `require("os")` with a typed, mobile-safe access that satisfies both rules WITHOUT lie/hack — e.g. a single well-typed desktop-only accessor (guarded dynamic import / typed require wrapper) shared by both files (DRY: same pattern appears twice — extract a small typed `DesktopOsInfo` helper under src/core/util/env/). Preserve EXACT resolution behavior (hostname for device name; userInfo().username for OS user name) — existing users' VH directory names depend on it. Keep the Platform.isDesktopApp guard and the mobile null-fallback.

VERIFY: `npm run lint` clean on both files (no os-import rule, no no-unsafe-*), `npm run build` + `npm test` green. Add/adjust unit tests for the shared helper (mobile → null, desktop → value).

## Acceptance Criteria

Both files free of the mobile os-import finding and no-unsafe-* on lines 39/43; behavior (hostname / userInfo().username, mobile=null) unchanged and test-covered; lint+build+test green.

