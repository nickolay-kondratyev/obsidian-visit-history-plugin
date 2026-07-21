---
id: nid_rv9wadneva15fs5ob0u3wp0x3_E
title: "Replace deprecated setWarning() with setDestructive() in ConfirmModal"
status: open
deps: []
links: []
created_iso: 2026-07-20T22:34:39Z
status_updated_iso: 2026-07-20T22:34:39Z
type: chore
priority: 3
assignee: CC_fable5_WITH-nickolaykondratyev
external-ref: obsidian-review-warnings
tags: [obsidian-review, ui]
---

Obsidian review bot recommendation at src/settingsTab/ConfirmModal.ts:28 — ButtonComponent.setWarning() is deprecated (Obsidian 1.13.0) in favor of setDestructive() (or setDestructive().setCta() for a destructive primary action).

WHY DEFERRED (NOT a safe drop-in): setDestructive() is @since 1.13.0 and does NOT exist before it. Plugin manifest minAppVersion=1.5.7, so a naive swap yields `TypeError: btn.setDestructive is not a function` for any user on Obsidian <1.13.0, breaking the doc-id-backfill confirm dialog. Also the local obsidian devDep (1.12.3) lacks the method, so tsc would fail to compile until bumped. The deprecation is a compile-time nag with a documented reason — no functional defect today.

## Acceptance Criteria

Do together with the minAppVersion/devDep bump (see the declarative-settings ticket). Once minAppVersion>=1.13.0 and obsidian devDep>=1.13.0: replace .setWarning() with .setDestructive() (this is the destructive CTA button — consider .setDestructive().setCta()). Alternatively, if still supporting <1.13.0, runtime feature-detect (typeof btn.setDestructive === "function") — but prefer the version bump over a cast.


## Owner decision (2026-07-20)
Keep supporting older Obsidian for now — 1.13.0 is catalyst (insider) only, not a
general release yet. BLOCKED: do not action until 1.13.0 is broadly released and
minAppVersion is deliberately raised. Current imperative `display()` / `setWarning()`
are the correct, sanctioned choices meanwhile.

## Notes

**2026-07-21T01:34:11Z**

Merged from duplicate ticket nid_8lj046abp2q27ahfeqw0fi3nr_E (deleted 2026-07-21).

Exact current suppression location: src/settingsTab/ConfirmModal.ts:33 — .setWarning() preceded by `// eslint-disable-next-line @typescript-eslint/no-deprecated` at line 32 (line moved from :28 after the 1.13.1 devDep bump).

Same trigger as dropping the imperative display() fallback in src/settingsTab/VisitHistorySettingTab.ts: when minAppVersion is raised to 1.13.0, switch to setDestructive() (or setDestructive().setCta()) and remove the eslint-disable.
