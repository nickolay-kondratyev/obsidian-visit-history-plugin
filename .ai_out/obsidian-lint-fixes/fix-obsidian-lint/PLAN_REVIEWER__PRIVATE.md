# PLAN_REVIEWER — private notes (fix-obsidian-lint)

## Verification done (all against live source)
- `grep -rn eslint-disable src` → 11 sites, EXACTLY matches plan's inventory table. No missed disable.
- FocusDurationTracker.ts read: 4 bare timer sites (255,261 idle; 323,329 grace), fields `ReturnType<typeof setTimeout>`. Plan's edits (a)-(e) map 1:1. Public API is `onDocFocused/onDocUnfocused/onWindowFocused/...`; only 2 constructors call sites (PluginFactory + the test). Confirmed test uses `onWindowFocused(MAIN_WIN)` seeding.
- FocusDurationTracker.test.ts read: uses `vi.useFakeTimers({now:T0})` in beforeEach, `vi.advanceTimersByTime`, `vi.setSystemTime` for sleep. Plan's beforeEach injection (build fake AFTER useFakeTimers) is correct; ordering rationale sound. No assertion changes needed.
- PluginFactory.ts read: line 126 `new WindowActivityMonitor(this.plugin, tracker, window, document)`; activateUserScopedRecording runs post-pin (onLayoutReady). Plan's rootSplit.win/doc substitution valid.
- DeviceNameProvider.ts / UserNameProvider.ts read: localStorage sites + require(os) sites match plan lines exactly.
- obsidian.d.ts: rootSplit:WorkspaceRoot(6807); WorkspaceRoot win/doc(7421/7423). Available at onLayoutReady.
- preferWindowTimers.js: only CallExpression (bare Identifier in TIMER_FUNCTIONS) or activeWindow.<timer>(). Object shorthand + member call both pass. CONFIRMED.
- preferActiveDoc.js: REPLACEMENTS={document}. bare `window` NOT flagged. noGlobalThis.js bans only global/globalThis. So window.localStorage clean.
- eslint.config.mts: globals.browser; test files not ignored (only vitest.config.ts, .tmp, .out, submodules). → browser globals in tests, no-undef clean.
- WindowActivityMonitor.ts ctor: (plugin, tracker, mainWindow:Window, mainDocument:Document) — unchanged.

## Type-check reasoning (the one subtle point)
- Interface uses METHOD signatures (`setTimeout(cb,ms):TimerHandle`) → bivariant params → global `setTimeout` assigns to `{setTimeout,clearTimeout}` literal even with @types/node overloads. TimerHandle=unknown widest. Plan documents `as unknown as WindowTimers` fallback (established codebase idiom). Not a blocker either way.
- `this`-binding: prod passes real Window (called as mainWindow.setTimeout → this=Window, correct). Test's fake is vitest plain fn ignoring this. No Illegal-invocation risk because prod never passes a `{setTimeout}` literal. Correct.

## Verdict: APPROVED. No blockers, no majors. No inline edits made (plan is accurate).
