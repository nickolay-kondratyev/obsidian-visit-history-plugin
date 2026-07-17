# CLARIFICATION — user-name confirmation modal

Human-aligned decisions (2026-07-17):

1. **Name charset: STRICT LOWERCASE** — allowed charset `a-z0-9._-` (lowercase only).
   - Desktop pre-fill sanitized automatically: `"John Doe"` → `john_doe` (lowercase +
     spaces→underscores; strip other disallowed chars).
   - Typed input normalized to lowercase and validated LIVE; confirm disabled (or clear
     error shown) until valid. Boundary rules stay (no leading/trailing dot, no empty,
     length cap ~200).
2. **No legacy-pin concerns**: there are NO deployed devices/users yet. No re-confirmation
   flow, no "change user name" follow-up needed for `mobile-user-*` pins (that code path
   is simply deleted).

Requirements recap (binding, from flow-1 conversation):
- Modal shown on any device with NO pinned name: pick one of the existing
  `__visit_history/user/` names OR enter a new name. Desktop pre-filled with sanitized
  OS login name; mobile never mints `mobile-user-<random8>`.
- Pin stays in device-scoped localStorage key `obsidian-vh-user-name` (non-synced,
  first-pin-wins). Already-pinned devices never see the modal.
- Dismissed modal → NO pin, NO VH recording that session, re-prompt on every plugin
  start until pinned. No recording until pinned (pre-confirm sessions lost — accepted).

Decisions by TOP_LEVEL_AGENT (flagged to human, unobjected):
- Modal opens on `onLayoutReady` (consistent with existing UI/IO deferral pattern).
- `UserNameProvider` resolution becomes nullable ("no name this session").
- Deferred-recording seam: exploration Option B — duration listener registered late
  (post-pin); `VhUserScopeMigrationService` + README startup task also run post-pin.
  Heatmap reads + doc-id assignment load eagerly (name-independent).
- Modal is a thin Obsidian adapter behind a testable `UserNamePrompt` interface
  (Promise<string | null>, null = dismissed); decision/pin logic unit-tested via
  `FakeUserNamePrompt`.
- Typing a name equal to an existing dir = joining that identity (allowed, not an error).
- Docs: flow-1's "silent single-dir mobile adoption may join a synced identity" sentence
  must be REPLACED by the modal behavior description (silent adoption is deleted).
