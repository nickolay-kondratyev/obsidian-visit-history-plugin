# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC (user-name confirmation modal)

Branch `user-name-confirm-modal`, commits `1154b64` (implementation) + `6cbcd51` (docs).

## What was done

1. **`UserNameSafety`** (new, `src/core/service/visitHistoryService/user/UserNameSafety.ts`):
   strict lowercase charset `a-z0-9._-`, no leading/trailing dot, 200-char cap (boundary
   rules mirror `DocIdFilenameSafety`, but a SEPARATE class — user names are a different
   domain with a stricter charset; doc-id logic not mislabeled). `isValidUserName` +
   `sanitizeToValidOrNull` ("John Doe" → "john_doe"; lowercase, whitespace runs → `_`,
   strip disallowed, strip boundary dots, cap, null when nothing valid remains).
2. **`UserNamePrompt`** (new interface, Obsidian-agnostic): `promptForUserName({existingNames,
   defaultName}): Promise<string | null>` (null = dismissed).
3. **`ModalUserNamePrompt`** (new, `user/impl/`): thin Obsidian `Modal` adapter mirroring
   `ConfirmModal` style. Existing-name rows with "Use this name" buttons (immediate confirm);
   text input pre-filled with the sanitized OS name, live-lowercased, Confirm (CTA) disabled +
   error text while invalid, Enter submits when valid, Cancel/Esc/X → resolve null (one-shot
   resolved guard). Error styling via `.vh-user-name-prompt-error` in styles.css.
4. **`UserNameProviderDefault` rework**: `getUserName(): Promise<string | null>`. Cached pin →
   silent return (already-pinned devices never see the modal). Otherwise prompt with existing
   `__visit_history/user/` dirs + sanitized OS pre-fill (null on mobile). Pin (`cache.set`,
   key `obsidian-vh-user-name` unchanged) ONLY on explicit confirmation; dismissal returns
   null, pins nothing, re-prompts next start.
5. **No recording until pinned (exploration Option B)**: `PluginFactory` ctor now takes only
   `plugin` and wires the name-independent graph (heatmap reads, doc-id listener, backfill,
   view stores). New `activateUserScopedRecording(userName)` constructs
   `FocusDurationTracker` + `WindowActivityMonitor`, late-registers
   `VhV3FocusDurationListener`, and kicks the README write (`VhStartupTasks`) — called by
   `main.ts#pinUserNameAndStartRecording` on `onLayoutReady` after resolution + the
   user-scope migration. `factory.dispose()` is null-safe for the no-name session
   (`onunload` uses it).
6. **`VhV3DurationStore` made name-free at construction**: the user name is now a PER-CALL
   parameter of `appendFocusDuration`/`readSessions` (mirrors `VhV3Paths`).
   `VhV3DurationRecorder` holds the pinned name (new ctor param).
7. **Deleted (WITH human approval — CLARIFICATION 2026-07-17, no deployed users)**: desktop
   OS-name auto-answer, mobile single-dir silent adoption, `mobile-user-<random8>` mint, and
   the three `UserNameProvider.test.ts` tests that encoded those behaviors (rewritten as
   modal-flow tests). No compat shims.

## Key decisions + rationale

- **Store refactor (6) instead of a dummy-name store**: the heatmap's aggregate read must
  exist PRE-pin; constructing the store with a placeholder name would be a lie. Per-call
  user name matches the `VhV3Paths` philosophy ("every method takes the user name").
- **Existing-dir names bypass the strict-charset check when picked** ("joining"): an existing
  dir already IS a working path segment (e.g. a pre-rule "Nickolay"); rejecting it would make
  "pick an existing name" impossible for such dirs. Typed NEW names are validated strictly.
  Provider re-validates whatever the prompt returns (defense in depth — the modal is an
  untested adapter).
- **Migration + orchestration stay in `main.ts`** (`pinUserNameAndStartRecording`), not in
  the factory: preserves the TODO(cleanup, 2026-Oct) "delete wiring in main.ts" contract for
  `VhUserScopeMigrationService`; factory keeps pure wiring. Ordering invariant kept:
  migration completes BEFORE recording activates.
- **Resolution is now error-isolated off the load path** — this RESOLVES ticket
  `docs/tickets/onload-fails-if-user-name-resolution-throws.md` (marked resolved in the file).
- **Whitespace runs collapse to ONE underscore** in sanitization ("John  Doe" → "john_doe") —
  nicer than one `_` per space; covered by a test.

## Tests / lint / build (actual numbers)

- `./node_modules/.bin/vitest run`: **37 files, 347 tests, all passing**
  (+22 new UserNameSafety tests; UserNameProvider suite rewritten 7 → 13 tests).
- `./node_modules/.bin/eslint .`: **0 errors**, 2 pre-existing warnings
  (`obsidianmd/prefer-active-doc` on the untouched status-bar lines in main.ts).
- `./node_modules/.bin/tsc -noEmit -skipLibCheck`: clean.
- `/usr/local/bin/node esbuild.config.mjs production`: clean (env note: bare `node`/`npm` are
  shadowed by a broken NVM profile function — use `/usr/local/bin/node` + `./node_modules/.bin/*`).

## Files changed

- New: `user/UserNameSafety.ts` (+test), `user/UserNamePrompt.ts`,
  `user/impl/ModalUserNamePrompt.ts`, `testSupport/FakeUserNamePrompt.ts`.
- Modified: `user/UserNameProvider.ts` (+test rewrite), `v3/VhV3DurationStore.ts` (+test),
  `focusDuration/VhV3DurationRecorder.ts` (+test), `v3/VisitHistoryServiceV3.test.ts`,
  `core/init/PluginFactory.ts`, `core/init/VhStartupTasks.ts` (comment), `main.ts`,
  `styles.css`, `v3/VhV3ReadmeWriter.ts` (generated README text),
  `migration/VhTopDirRenameMigrationService.ts` + `VhUserScopeMigrationService.ts` (comments).
- Docs: `AGENTS.md` (CLAUDE.md is its symlink), `docs/architecture.md`,
  `docs/visit-history-format.md`, `docs/tickets/onload-fails-if-user-name-resolution-throws.md`.

## Scrutiny points

- **Post-pin activation gating is NOT unit-tested** — `PluginFactory` wiring (incl. late
  listener registration and `activateUserScopedRecording`) still needs a full App mock; kept
  trivial per the existing "known untested seam" policy (documented in AGENTS.md testing
  section already). `ModalUserNamePrompt` likewise an untested thin adapter (obsidianMock has
  no `Modal`/`Setting`).
- **Doc focused at pin time**: the V3 listener registers late, so the doc already focused
  when the user confirms gets no `onFocus` — its ongoing session is unrecorded until the next
  navigation. Consistent with the accepted "pre-confirm sessions lost".
- **A pinned device dodges validation forever** (pin read back verbatim) — intentional
  first-pin-wins; an invalid name can only enter via manual localStorage edits.
- **Live lowercasing** uses `text.setValue(lowered)` on change — caret jumps to end if a user
  edits mid-word with uppercase; accepted (PARETO).
- **Not manually driven in Obsidian** — headless env; modal layout/UX (button order, error
  text) verified by code review only. Recommend a quick human smoke test of the modal.
