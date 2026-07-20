# DETAILED PLAN REVIEW — Obsidian submission lint fixes

Reviewer: PLAN_REVIEWER. Inputs: `EXPLORATION_PUBLIC.md`, `DETAILED_PLANNING__PUBLIC.md`,
verified against live source + `node_modules/eslint-plugin-obsidianmd/dist` + `obsidian.d.ts`.

## Executive summary
The plan is correct, complete, and hack-free. Every claim it relies on was independently
verified against the rule sources, the eslint config, the obsidian type defs, and the actual
files edited. The injected-`WindowTimers` design is the right DIP-clean fix (member call →
rule-clean; class stays node-testable), the test double is genuinely lint-clean AND fake-clock-
driven, and the `rootSplit.win/doc` substitution preserves the main-window semantics. Scope is
right. **APPROVED — proceed to IMPLEMENTATION.**

## Critical issues (BLOCKERS)
None.

## Major concerns
None.

## Correctness verification (the load-bearing points)

1. **Will each edit clear the specific bot error? YES.**
   - `grep -rn eslint-disable src` returns exactly 11 sites; the plan's inventory table matches
     them 1:1 (4× prefer-window-timers, 1× prefer-active-doc, 4× no-restricted-globals, 2×
     require-os). No `eslint-disable` in `src` is missed.
   - After the change the only remaining disables are the two `require("os")` lines, each getting
     a `-- <reason>` description → satisfies the "undescribed directive" bot rule.

2. **No residual/reintroduced forbidden globals? CONFIRMED CLEAN.**
   - `preferWindowTimers.js` reports ONLY a `CallExpression` whose callee is a bare Identifier in
     `{setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame}`, or
     `activeWindow.<timer>()`. `this.timers.setTimeout(...)` is a MemberExpression call (object =
     `this.timers`, not `activeWindow`) → not flagged. The test's `{ setTimeout, clearTimeout }`
     object shorthand is a Property/Identifier reference, not a CallExpression → not flagged.
   - `preferActiveDoc.js` REPLACEMENTS = `{ document }` only → bare `window` is never flagged, so
     `window.localStorage` is clean re: this rule. `noGlobalThis.js` bans only `global`/`globalThis`
     — the plan uses neither. No `globalThis`/`activeWindow` reintroduced.
   - `no-restricted-globals` flags bare identifiers (`app`/`fetch`/`localStorage`) only;
     `window.localStorage.getItem(...)` has bare identifier `window` (allowed) and `localStorage`
     as a member access (not flagged).

3. **Injected `WindowTimers` + test double — (a) lint-clean, (b) type-correct, (c) fake-clock-driven? ALL YES.**
   - (a) See point 2 — shorthand + member calls are clean; `window`/`globalThis` never referenced;
     `setTimeout`/`clearTimeout` are `globals.browser` (eslint) → `no-undef` clean. Test files are
     NOT in `globalIgnores` (only vitest.config.ts/.tmp/.out/submodules are), so they are linted
     with the same browser globals — verified.
   - (b) The interface uses METHOD signatures, so parameter checking is bivariant; the global
     `setTimeout` assigns to `{ setTimeout, clearTimeout }: WindowTimers` even under @types/node
     overloads, with `TimerHandle = unknown` as the widest return. The documented
     `as unknown as WindowTimers` fallback (already an established codebase idiom in
     `WindowActivityMonitor.test.ts`) covers any residual friction. tsc (`lib ES2021+DOM`,
     test files type-checked) is satisfied.
   - (c) Ordering is correct and explicitly called out: the literal is built AFTER
     `vi.useFakeTimers({ now: T0 })` in the same `beforeEach`, so the shorthand captures the FAKE
     globals and `vi.advanceTimersByTime()` drives them. `this`-binding is safe: production passes
     the real `Window` (called as `mainWindow.setTimeout` → `this` = Window, correct); vitest's
     fakes are plain functions that ignore `this`. Production never passes a bare `{setTimeout}`
     literal, so no "Illegal invocation" risk.

4. **`rootSplit.win/.doc` correct + available at `onLayoutReady`, preserves main-window semantics? YES.**
   - `obsidian.d.ts`: `Workspace.rootSplit: WorkspaceRoot` (6807); `WorkspaceRoot` declares
     `win: Window` (7421) and `doc: Document` (7423). `activateUserScopedRecording` runs on
     `onLayoutReady`, when `rootSplit` is populated. This is the MAIN window specifically — same
     guarantee the old `window`/`document` + WHY-NOT-activeDocument comment made; the monitor still
     registers popouts itself. `WindowActivityMonitor`'s signature `(…, mainWindow: Window,
     mainDocument: Document)` is unchanged, so passing `mainWindow`/`mainDocument` is a
     straight-line substitution.

5. **Any HACK or behavior change? NONE.**
   - No global shadowing, no `globalThis`, no `as`-cast except the documented fallback boundary
     idiom. Timer semantics unchanged (scheduler merely injected). Device-scoped `window.localStorage`
     keeps the same keys and semantics (`window.localStorage` === `localStorage` at runtime).
     WindowActivityMonitor stays bound to the MAIN window. Tracker state machine untouched — the
     full existing 40-case suite is the safety net and needs no assertion edits.

6. **Scope correct? YES.** `main.ts:133,137` (bare `document.body`) are pre-existing
   `prefer-active-doc` WARNINGS with no disable directive, so the bot did not list them; Option B
   (leave as-is) is the right minimal-scope call. Do not touch `main.ts`.

## Simplification opportunities (PARETO)
- Already taken: the plan correctly rejects the exploration's heavier `Timers{set,clear}` +
  `WindowTimers` adapter class in favor of the bare `{setTimeout,clearTimeout}` subset interface
  (no wrapper, no renaming, mirrors Obsidian's `win.setTimeout` idiom). This is the 80/20 choice.

## Minor suggestions (non-blocking)
- In `armIdleTimer`/`armGraceTimer`, keep a one-line WHY pointer near the field or method (the plan
  moves the rationale onto the `WindowTimers` interface doc — good; just ensure the deleted 3-line
  WHY-NOT block's intent isn't fully lost). The plan already says to keep a short rationale — fine.
- Implementer: prefer the un-cast `{ setTimeout, clearTimeout }`; only fall back to the cast if tsc
  actually complains, and if so mirror the existing `WindowActivityMonitor.test.ts` idiom.

## Strengths
- Complete, grep-verified disable inventory; no missed site.
- Correct, precise reading of all three rule engines (call-vs-reference, member-vs-bare, REPLACEMENTS).
- The single subtle risk (fake-timers capture ordering) is identified, isolated, and commented.
- Behavior-preservation is argued per-file and backed by the untouched existing test suite.

## Verdict
**APPROVED — proceed to IMPLEMENTATION (PLAN_ITERATION can be skipped).**
No inline edits were made to the plan (it is accurate as written).
