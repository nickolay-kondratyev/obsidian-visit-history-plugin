# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (user-name confirm modal)

## Goal
Replace silent user-name auto-resolution with a confirmation modal; no VH recording until pinned.
Binding decisions: CLARIFICATION__PUBLIC.md (strict lowercase `a-z0-9._-`, modal on onLayoutReady,
nullable getUserName, Option B late listener registration, delete silent paths, no compat shims).

## Plan (checklist)

1. [ ] `user/UserNameSafety.ts` + test — `isValidUserName` (pattern `/^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/`),
       `sanitizeToValidOrNull(raw)` (lowercase → whitespace-runs→`_` → strip disallowed → strip lead dots →
       truncate 200 → strip trail dots → validate-or-null). Separate from DocIdFilenameSafety (stricter charset,
       different domain — do NOT mislabel doc-id logic).
2. [ ] `user/UserNamePrompt.ts` — `UserNamePromptRequest { existingNames: string[]; defaultName: string | null }`,
       `UserNamePrompt { promptForUserName(req): Promise<string | null> }` (null = dismissed).
3. [ ] `user/impl/ModalUserNamePrompt.ts` — exported `ModalUserNamePrompt implements UserNamePrompt` (creates
       one-shot private `UserNamePromptModal extends Modal` per call). Thin, UNTESTED adapter (obsidianMock has no
       Modal). Existing-name rows = Setting + "Use this name" button (resolve immediately). Text input pre-filled
       defaultName, live lowercased in onChange, Confirm (setCta) disabled while invalid, error `<p>` with class
       `vh-user-name-prompt-error` (styles.css rule, var(--text-error)). Enter submits when valid. Cancel button.
       onClose → resolve(null) once (resolved flag).
4. [ ] `UserNameProvider.ts` rework — `getUserName(): Promise<string | null>`; ctor gains `prompt: UserNamePrompt`
       (2nd param). cached→return; else list existingNames, defaultName = sanitize(os) (null mobile), prompt;
       null→return null (NO cache.set); pin+return when `existingNames.includes(chosen) || isValidUserName(chosen)`
       (existing-dir exemption: dir name is already a valid path segment; joining allowed — note in PUBLIC);
       else console.error + null (defense in depth vs untested adapter). DELETE OS-auto-answer, single-dir adoption,
       mobile-user mint (approved deletion).
5. [ ] `testSupport/FakeUserNamePrompt.ts` — answer, lastRequest, promptCount.
6. [ ] `UserNameProvider.test.ts` rewrite (old mobile-adoption/random-mint tests encode DELETED behavior —
       human-approved). New: cached wins + no prompt; existingNames passed; desktop sanitized pre-fill; mobile null
       pre-fill; confirm→pinned+returned; dismiss→null+not pinned+re-promptable; invalid from prompt→null not pinned;
       existing-dir uppercase name→pinned (joining).
7. [ ] X3 store refactor: `VhV3DurationStore` ctor drops `userName`; `appendFocusDuration(userName, device, docId, ...)`,
       `readSessions(userName, device, docId)` (absorbs private readSessionsForUser). WHY: heatmap aggregate read is
       name-independent and must exist PRE-pin; per-call user matches VhV3Paths philosophy; no dummy-name lies.
       `VhV3DurationRecorder` ctor gains `userName` (4th param) — constructed post-pin. Update
       VhV3DurationStore.test.ts / VhV3DurationRecorder.test.ts / VisitHistoryServiceV3.test.ts call sites.
8. [ ] `PluginFactory.ts` — ctor(plugin) only (no userName). Eager: everything name-independent incl.
       focusTracker+DocIdFocusListener, store, VisitHistoryServiceV3, vaultUtil, backfill, contentTermMatcher,
       `readonly userNameProvider = new UserNameProviderDefault(hiddenFileUtil, new ModalUserNamePrompt(app))`.
       POST-PIN `activateUserScopedRecording(userName): void` (double-call guard → console.error+return):
       constructs FocusDurationTracker (recorder w/ userName), WindowActivityMonitor, registers
       VhV3FocusDurationListener, fire-and-forget `new VhStartupTasks(new VhV3ReadmeWriter(hidden, userName)).run()`
       (error-isolated inside). `dispose(): void` → `focusDurationTracker?.dispose()` (private optional field).
       Fields kept: plugin, hiddenFileUtil, deviceNameProvider, lastVisitCache, vhV3DurationStore as privates.
       Remove vhStartupTasks/focusDurationTracker public readonly fields.
9. [ ] `main.ts` — onload: top-dir rename migration unchanged; NO user-name resolution; factory = new PluginFactory(this);
       onLayoutReady → `void this.pinUserAndStartRecording(factory, hiddenFileUtil)`:
       try { name = await factory.userNameProvider.getUserName(); if null return (dismissed — re-prompt next start);
       try VhUserScopeMigrationService(hidden, name).migrateIfLegacyPresent() catch console.error (stays in main.ts
       for easy 2026-Oct cleanup); factory.activateUserScopedRecording(name); } catch console.error.
       Ordering invariant: migration BEFORE recording activation (never write legacy layout mid-move).
       onunload → `this.factory?.dispose()`.
10. [ ] styles.css — `.vh-user-name-prompt-error` rule.
11. [ ] Docs: AGENTS.md (summary line if needed, tree comments for main.ts/user/, user-scoping bullet — replace
        silent-adoption sentence with modal behavior + no-recording-until-pinned), docs/architecture.md
        (tree + "Startup flow" section), docs/visit-history-format.md ("User name" bullet + migration ordering note).
        Check docs/tickets/onload-fails-if-user-name-resolution-throws.md — resolution now off onload path; note.
12. [ ] Verify: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -noEmit -skipLibCheck`,
        `./node_modules/.bin/eslint .`, esbuild prod build → .tmp/ outputs. (bare npm may be broken)
13. [ ] Write 1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md; commit at milestones on branch user-name-confirm-modal.

## Key gotchas
- obsidianMock lacks Modal/Setting — nothing test-imported may pull ModalUserNamePrompt. UserNameProvider.ts imports
  only the UserNamePrompt interface. PluginFactory (imports modal) stays the known untested seam.
- Late VhV3FocusDurationListener: doc focused before activation gets no onFocus → its ongoing session unrecorded
  until next nav (consistent with "pre-confirm sessions lost — accepted"); scrutiny point in PUBLIC.
- FocusTracker.registerListener is additive/public — late registration clean.
- WindowActivityMonitor discovers already-open popouts at construction → safe to construct post-layout-ready.
- onLayoutReady callback runs after onload returns → top-dir rename (awaited in onload) always precedes prompt's
  dir listing.
- Recorder param order: (store, lastVisitCache, deviceNameProvider, userName).
- Git: commit as milestones; Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>.

## State
- ALL plan steps 1-13 DONE.
- Actual seams that differed from plan: migration + orchestration kept in main.ts
  (`pinUserNameAndStartRecording`) instead of inside factory activate — preserves the
  2026-Oct cleanup contract; factory only wires + kicks VhStartupTasks.
- Extra doc fixes beyond plan: VhV3ReadmeWriter generated README text (mobile-adoption
  bullet), VhTopDirRenameMigrationService + VhUserScopeMigrationService comments,
  VhStartupTasks comment, onload-throws ticket marked RESOLVED.
- Verify results: vitest 37 files / 347 tests pass; eslint 0 errors (2 pre-existing
  prefer-active-doc warnings in main.ts status-bar code); tsc clean; esbuild prod clean.
- Env gotcha: bare `node`/`npm` shadowed by broken NVM shell function — use
  `/usr/local/bin/node` and `./node_modules/.bin/*`.
- Commits: 1154b64 (impl), 6cbcd51 (docs); artifacts commit follows.
- PUBLIC.md: 1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md written (deleted behaviors,
  decisions incl. existing-dir validation exemption, scrutiny points).
