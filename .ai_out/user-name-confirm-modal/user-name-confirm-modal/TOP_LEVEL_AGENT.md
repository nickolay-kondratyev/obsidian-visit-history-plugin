# TOP_LEVEL_AGENT — user-name-confirm-modal

## Task
Replace silent user-name auto-resolution with a confirmation MODAL on devices with no
pinned name: pick an existing `__visit_history/user/` name OR enter a new one
(filename-safe). Desktop pre-populated with OS login name; mobile never mints
`mobile-user-<random8>` anymore. Pin stays in device-scoped localStorage (non-synced).

## HUMAN-approved requirements (from flow-1 conversation, 2026-07-16/17)
1. Dismissed modal → NO pin, NO VH recording that session, re-prompt on EVERY start until pinned.
2. No VH recording until name pinned (pre-confirm sessions lost — accepted).
3. Devices with an already-pinned name NEVER see the modal.
4. Rename flow (flow 1) merged first (84fc53f); this is a fresh flow on branch `user-name-confirm-modal`.

## Flow (straightforward-flow)
EXPLORATION → CLARIFICATION(if needed) → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Status log
- [x] Flow 1 (rename-visit-history-dir) merged to master: 84fc53f
- [x] Branch `user-name-confirm-modal` created
- [x] EXPLORATION → EXPLORATION_PUBLIC.md (commit 2ea0010)
- [x] CLARIFICATION → CLARIFICATION__PUBLIC.md (commit f1f6309)
      Human: strict LOWERCASE charset a-z0-9._- with auto-sanitized pre-fill ("John Doe"→"john_doe");
      no deployed users yet → old silent paths simply deleted, no compat/rename affordance.
- [x] IMPLEMENTATION_WITH_SELF_PLAN → 1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md
      Claims: 347/347 tests, lint 0 errors, tsc + build clean; commits 1154b64, 6cbcd51, b4f1ff6.
      UserNameSafety + UserNamePrompt DIP + ModalUserNamePrompt adapter; nullable getUserName;
      PluginFactory split (eager reads / activateUserScopedRecording post-pin); store name-free at ctor.
      Flagged decision: existing-dir pick bypasses charset validation (reviewer to scrutinize).
- [x] IMPLEMENTATION_REVIEW → IMPLEMENTATION_REVIEW__PUBLIC.md
      Verdict NEEDS_ITERATION: B1 BLOCKING (pinned-device startup session lost — late listener misses
      restore-time focus event), S1 (modal/activation outlives unload), G1 (cross-vault first-pin race),
      G2 (double-resolve guard). Reviewer verified 347/347, lint 0, tsc+build clean.
      B1 "accept vs fix" resolved by TOP_LEVEL without human: fix (replay) — preserves prior behavior;
      behavior REMOVAL would need approval, restoration does not.
- [x] IMPLEMENTATION_ITERATION round 1: B1+S1+G1+G2 fixed (commit 4e00515) — 355/355 tests
- [x] RE-REVIEW (fresh reviewer instance, rehydrated): verdict READY — 4/4 FIXED verified in code;
      round-1 #QUESTION_FOR_HUMAN moot (replay implemented); 1 new suggestion N1 (unloaded
      check before getUserName in pinUserNameAndStartRecording).
- [x] N1 micro-fix applied (commit 4a121d3) — 355/355 tests, lint 0 errors, tsc clean
- [x] Tickets: onload-fails-if-user-name-resolution-throws marked RESOLVED by this flow;
      no new follow-ups needed (no deployed users → no rename-affordance ticket; env nvm
      ticket pre-exists).
- [x] Final: change log below; merge to master.

## Change log (single entry for entire flow)

**2026-07-17 — user-name-confirm-modal** (branch `user-name-confirm-modal`)
User name is now chosen via a confirmation MODAL instead of silent auto-resolution:
on any device with no pinned name, a modal (on `onLayoutReady`) offers the existing
`__visit_history/user/` identities or a new name — lowercase filename-safe charset
`a-z0-9._-` (`UserNameSafety`; desktop pre-fill = sanitized OS login name, "John Doe" →
"john_doe"; picking an existing dir joins that identity). Pin only on explicit confirm,
in device-scoped localStorage (`obsidian-vh-user-name`, non-synced, first-pin-wins —
post-prompt re-check makes this race-safe); dismiss → no pin, re-prompt next start.
Silent desktop/mobile/random resolution DELETED (human-approved; no deployed users).
Plugin loads fully name-less: heatmap reads + doc-id assignment eager; V3 recording,
user-scope migration, README task activate post-pin (`activateUserScopedRecording`;
late-registered listener gets the last focus event REPLAYED on the serialized dispatch
chain, so the startup-restored note's session is never lost). Unload-safety: open modal
closed on dispose; pin/activation bail out post-unload. DIP: `UserNamePrompt` interface;
Obsidian `ModalUserNamePrompt` is a thin logic-free adapter. Resolves ticket
onload-fails-if-user-name-resolution-throws. Tests 355 green (+36 this flow), lint 0
errors, tsc + production build clean. Review: 2 rounds → READY (B1 blocking regression
fixed via replay; S1/G1/G2/N1 applied).
