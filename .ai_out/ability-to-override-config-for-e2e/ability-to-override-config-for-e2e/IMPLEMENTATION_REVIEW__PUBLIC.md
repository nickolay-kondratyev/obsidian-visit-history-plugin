# IMPLEMENTATION REVIEW — dev config overrides for e2e — PUBLIC

## Verdict: APPROVE_WITH_MINOR

Clean, well-abstracted delivery of the ticket. The override mechanism is genuinely hidden
behind `ConfigProvider`; env-var/fs knowledge is confined to `src/core/config/`. Prod is
inert (byte-for-byte unchanged with no env var). Build/lint/test/e2e-typecheck all green.
No blocking or major issues. One minor DRY note and a couple of nits below.

## Verification (ran locally)
- `npm test` → 404 passed (42 files), exit 0. 18 new config tests.
- `npm run lint` → 0 errors, 1 warning (pre-existing `ConfirmModal.setWarning` deprecation — not this change).
- `npm run build` → exit 0.
- `npx tsc -p e2e/tsconfig.json` → exit 0.

## Focus-area confirmations
1. **Requirements met — CONFIRMED.** Override wins over the persisted setting with NO
   re-clamp to the min-5 s floor (`ConfigProvider.ts:37-45`); mechanism sits entirely behind
   the `ConfigProvider` seam; `FocusDurationTracker`'s idle closure now routes through it
   (`PluginFactory.ts` closure → `configProvider.getIdleTimeoutMs()`). New e2e
   `idleTimeoutOverride.e2e.ts` drives a sub-floor (1 s) idle close and asserts on-disk,
   avoiding the long wait. No env-var/fs leakage outside `src/core/config/`.
2. **Correctness — CONFIRMED.** Precedence + floor bypass correct; zero/negative/NaN/malformed
   → falls back to live setting (`ConfigProvider.ts:41` guard; `DevConfigOverridesReader.ts:47`
   type-narrow). Env-gated fs read is inert when unset (`DevOverridesFileSource.ts:44` →
   null → empty overrides). Mobile-safe (`Platform.isDesktop/isDesktopApp` guards +
   try/catch, mirrors `DesktopOsInfo`). Never throws on missing/malformed; `console.error`
   only when the path WAS provided (unreadable file, invalid JSON). PluginFactory constructs
   the provider once, reads overrides once, passes the plugin as the structural host so the
   settings path stays a LIVE read (verified against `FocusDurationTracker` calling the
   closure at every idle decision: lines 205/245/282/306).
3. **Design/quality — CONFIRMED.** interface+Default pattern throughout; narrow structural
   host (`ConfigSettingsHost`, not the whole Plugin) mirrors `HeatmapSettingsHost`; no `as`
   casts except the typed system-boundary `require('fs') as DesktopFsModule` and the
   `JSON.parse` unknown-narrow; no free-floating functions; string-literal-only (no enums);
   only `idleTimeoutSeconds` wired (Pareto — no unused keys). The 3-class split
   (ConfigProvider / DevConfigOverridesReader / DevOverridesFileSource) is JUSTIFIED, not
   over-engineered: it isolates the untestable fs+env boundary from the pure-testable parse
   and pure-testable resolution, which is exactly why `DevConfigOverridesReader.test.ts` and
   `ConfigProvider.test.ts` can cover their logic fully without touching Node builtins.
4. **Tests — CONFIRMED.** Logical coverage is strong: no-override, override-present,
   sub-floor, zero, negative, NaN, live-settings-change (ConfigProvider); null/valid/
   non-number/malformed/non-object/read-once (Reader); mobile/non-Electron/unset/unreadable
   (Source). BDD naming, mirrored files, boundary-only fakes. e2e threshold (poll 10 s,
   assert <4 s vs ~1 s expected) is robust — `elapsedMs` is measured from poll start
   immediately after `openFile`, so the fixed 1 s idle timer leaves ~3 s of slack.
5. **Security — CONFIRMED.** Reading an env-var-named path is an acceptable dev seam: the
   var (`__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__`) is set only by the e2e harness,
   the read is desktop-guarded + try/catch, and when unset the whole path is skipped. No
   network/telemetry introduced. No path is written; read-only.
6. **Docs — CONFIRMED.** `AGENTS.md` (=CLAUDE.md) architecture tree + key-decision bullet
   are accurate and succinct; `docs/e2e-testing.md` "Dev config overrides" section matches
   the implementation and points to the env-var source of truth. `e2e/constants.ts` carries
   the sync-pointer comment for the duplicated env-var name.

## Findings (prioritized)

- **[minor] DRY — desktop-guard/typed-require/try-catch pattern duplicated.**
  `src/core/config/DevOverridesFileSource.ts:31-60` and `src/core/util/env/DesktopOsInfo.ts`
  now carry the identical `Platform.isDesktop && Platform.isDesktopApp` guard + typed
  `require(...)` + try/catch + the same rationale comment (near copy-paste). This is a
  knowledge duplication (the "how to safely reach a desktop-only Node builtin" rule).
  Suggested fix: extract a shared `DesktopNodeModule.require<T>(name): T | null` (or a
  `tryRequireDesktop`) static helper in `core/util/env/` and have both call sites use it.
  Pareto-acceptable to defer with a follow-up ticket; flagging because the WHY-comment is
  literally written twice, which CLAUDE.md calls out as the extraction heuristic.

- **[nit] `DevConfigOverrides` shape declared twice** (`DevConfigOverridesReader.ts:9` and
  `e2e/obsidianHarness.ts`). Intentional and documented (e2e can't import src), same
  precedent as `e2e/constants.ts`. No action needed — noting for completeness.

- **[nit] Provider's `Number.isFinite` guard is partly defensive-only.** JSON cannot encode
  NaN/Infinity, so `DevConfigOverridesReader.parse` never yields them; the finite check in
  `ConfigProvider.ts:41` only bites if `DevConfigOverrides` is constructed in code (as the
  unit test does). Harmless belt-and-suspenders at the seam — keep it.

## #QUESTION_FOR_HUMAN
None.
