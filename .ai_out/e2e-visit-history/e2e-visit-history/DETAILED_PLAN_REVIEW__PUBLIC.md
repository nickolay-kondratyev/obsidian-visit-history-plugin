# DETAILED_PLAN_REVIEW — Real-Obsidian Playwright e2e plan

## Verdict: APPROVE-WITH-MINOR-INLINE-FIXES
PLAN_ITERATION can be **SKIPPED**. The inline corrections are already applied (marked
`[PLAN_REVIEWER inline fix]`). No approach/scope change required.

Critical: 0 · Major: 1 (corrected inline + ticketed) · Minor: 3

The plan is strong: honestly gated on a feasibility spike, asserts on-disk (never internals),
deterministic identity via localStorage, bounded polling (no sleeps), serial workers, and it
keeps `obsidian` types-only. I verified the load-bearing claims against source and they hold.

## Verified against source (all correct)
- **localStorage keys** exact: `obsidian-vh-user-name` (`UserNameProvider.ts:44`),
  `obsidian-device-name` (`DeviceNameProvider.ts:14`). Setting both before enable pins both the
  user path and the `e2e_device` directory (DeviceNameProvider: cached localStorage wins).
- **onLayoutReady-after-enable is the correct crux.** `main.ts:59` registers the pin inside
  `onLayoutReady`; enabling the plugin *after* layout is already ready invokes the callback
  immediately → `getUserName()` reads the pre-set localStorage → no modal. Requires
  `community-plugins.json = []` so the plugin does NOT auto-enable before the pin is set — the
  plan states this requirement (§2). Sound.
- **Constants:** `UNFOCUS_GRACE_MS = 10_000`, `MIN_IDLE_TIMEOUT_SECONDS = 5`,
  `DEFAULT_IDLE_TIMEOUT_SECONDS = 180`. Match the plan.
- **S2 flush path:** `disablePlugin` → `onunload` → `factory.dispose()` →
  `focusDurationTracker.dispose()` best-effort flush. Testing the graceful disable flush (not
  SIGKILL) is the correct, deterministic choice and matches the accepted hard-quit limitation.

## Major (1) — CORRECTED INLINE + ticketed
- **Grace-path mental model was wrong for S1 & S4.** The plan narrated "open A → open B →
  `onUnfocus(A)` → 10 s grace → A closes." In reality, focusing a DIFFERENT tracked doc calls
  `finalizePendingClose()` immediately (`FocusDurationTracker.ts:146`), closing A at its unfocus
  stamp with NO 10 s wait. Impact:
  - The ACs remain valid (they are upper-bound `≤15 s` polls) — not a blocker.
  - But the narrative would mislead the implementer (expecting/adding a 10 s wait, or misreading
    a prompt close as a bug), and it exposes a coverage note: **none of the 5 required scenarios
    exercise the 10 s grace-timer EXPIRY path** (nor the same-doc-refocus-within-grace cancel).
  - Fix applied: corrected S1/S4 narratives, corrected the "high idle vs grace" framing in §8,
    and added a low-priority follow-up ticket in §9 for a dedicated grace-expiry spec (out of the
    required 5 — the required scenarios stand as-is).

## Minor (3)
1. **S1 AC1.3 asserts absence** ("B has no closed line while focused") — inherently timing-based
   and could false-pass if the writer is merely slow. The plan justifies it (positive path proves
   the writer). Suggestion (optional): after asserting B absent, close B (switch away / disable)
   and confirm B THEN gets exactly one line — converts the negative into a positive confirmation
   of per-doc isolation. Low ROI; leave to implementer.
2. **`e2e/constants.ts` duplicates knowledge** (ids, keys, `VH_TOP_DIR`, session regex) — a real
   DRY cost, but explicitly forced by the types-only `obsidian` constraint and flagged with a
   sync-pointer WHY comment (§5.8). Acceptable. If cheap, a tiny "shape" test that reads the
   seeded id back from the produced path already cross-checks most of it. Optional.
3. **S5 idle drive** relies on API-driven `openFile` not registering as synthetic input (so the
   5 s idle timer fires). Plausible, and AC5.3 (elapsed < ~9 s) guards against a grace-path false
   positive; the keydown strengthening is correctly optional. Implementer should confirm during
   Milestone 2 that no input event resets idle on API-driven open.

## On the specific questions asked
- **Feasibility (M1 headless boot + CDP attach):** genuinely unproven, but the plan handles it
  correctly — a HARD-GATE spike first, explicit exit criteria, and an honest §7 fallback (no fake
  green). The libs/network pre-check is a reasonable de-risk. Milestone ordering is right.
- **localStorage-before-layoutReady:** mechanism is real and correct (see Verified section) —
  it hinges on `community-plugins.json = []` + enable-after-set, both specified.
- **Close/unload scenario tests the right thing:** yes — graceful `disablePlugin` flush, with
  SIGKILL explicitly a documented limitation, not a flaky assertion. Correct.
- **Idle (5 s floor) & 10 s grace:** floor handled (S5 uses 5, budgets ~12 s). Grace handled for
  the close semantics, with the Major correction that switch tests don't wait it out.
- **#QUESTION_FOR_HUMAN (Settings modal semantics):** the planner's default — empirically probe
  in M2, write the spec to observed truth, ticket the gap if Settings doesn't end a session — is
  SOUND and does NOT need resolving before implementation. The plan proceeds correctly either
  way and never asserts a close the product doesn't perform. Keep the question open for the owner;
  it is not a blocker.
- **File manifest / package.json / .gitignore / types-only:** correct. `.gitignore` commits the
  seed vault but ignores the installed build (`.dev-vault/.obsidian/plugins/`); pinned
  `@playwright/test`; explicit "do NOT run `playwright install`" (connectOverCDP) — important and
  right; ACH.4 grep enforces no runtime `obsidian` import.

## Strengths
- Assertions strictly on-disk `.vh_v3`; bounded `pollForSessionLine` with last-seen content on
  timeout (no silent pass); `workers:1` / `fullyParallel:false`; durations asserted as bounded
  ranges + line count + format, not exact ms.
- Determinism spine (localStorage pin + pre-seeded ids + per-test `data.json`) is minimal and
  well-reasoned; empty-workspace-at-enable avoids depending on focus replay.
- Honest failure protocol throughout (EARN_TRUST): hard gate, loud fallback, no faked pass.

## Recommendation
Proceed to implementation. Honor the inline `[PLAN_REVIEWER inline fix]` corrections. The one
substantive fix is a narrative/coverage correction, not an approach change.
