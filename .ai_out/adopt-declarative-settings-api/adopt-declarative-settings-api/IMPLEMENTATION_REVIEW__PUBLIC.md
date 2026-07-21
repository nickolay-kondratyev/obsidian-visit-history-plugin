# IMPLEMENTATION_REVIEW — Adopt declarative settings API

Ticket: `nid_apqgkqd35dmxuk6jqk6l7body_E`. Commit reviewed: `8482814`.

## Verdict: APPROVE-WITH-NITS

Clean, faithful implementation of Approach B. The declarative API is used correctly
against the verbatim 1.13.1 types, no regression to the pre-1.13 `display()` path,
DRY shared constants + predicate, `minAppVersion` untouched (1.5.7). One tracking-hygiene
issue (duplicate follow-up ticket) and two minor code nits — none blocking.

## Gates (run by reviewer, actual numbers)
- `npm run build` → **PASS** (exit 0; tsc + esbuild, no errors).
- `npm run lint` → **PASS** (exit 0; **0 errors**, 2 pre-existing warnings in `src/main.ts:133/137` `obsidianmd/prefer-active-doc` — untouched, already ticketed).
- `npm test` → **PASS** (exit 0; **Test Files 38 passed**, **Tests 379 passed** — +13 new, matches the implementer's claim).

## Correctness vs EXPLORATION_API.md (all confirmed correct)
- `getSettingDefinitions(): SettingDefinitionItem[]` — synchronous, plural, returns plain data. ✔ (`VisitHistorySettingTab.ts:55`)
- Number control fields — `type:'number'`, `key`, `defaultValue`, `min`, `step:1`, `placeholder`, `validate` all present and typed; matches `SettingNumberControl`. ✔ (`:60-72`)
- `type:'group'` + `heading` + `items[]` with a `render` escape hatch (`(setting) => setting.addButton(...)`) — correct, since no declarative button control exists. ✔ (`:74-90`)
- `setControlValue(key: string, value: unknown): void | Promise<void>` — override signature correct; `async … Promise<void>` is a valid narrowing. Boundary cast `as unknown as Record<string, unknown>` is documented and scoped. ✔ (`:99-104`)
- `validate` param is correctly inferred as `number` (from `SettingControlBase<number>`), feeding `isValidIdleTimeoutSeconds(seconds: number)` — type-safe, no cast. ✔

## No regression (confirmed)
- `display()` renders the identical imperative UI (same `Setting` rows, same idle-timeout text field with silent-reject via the shared predicate, same ConfirmModal backfill flow). ✔ (`:107-141`)
- `manifest.json` `minAppVersion` = **1.5.7**, UNCHANGED; `versions.json` untouched. ✔
- `import type VisitHistoryPlugin` avoids pulling `main.ts` (extends the un-mocked `Plugin`) into the test module while still passing the runtime plugin value through `super()`; build confirms this compiles. ✔
- Validation parity: declarative `validate` rejects exactly the old text-field's rejects (non-integer, `< MIN_IDLE_TIMEOUT_SECONDS=5`) via the SAME `isValidIdleTimeoutSeconds` predicate; sentence-case + deliberate lowercase "ids" + `≥` preserved. ✔

## Findings

### SHOULD-FIX
1. **Duplicate follow-up ticket for the setWarning migration.**
   The commit adds `nid_8lj046abp2q27ahfeqw0fi3nr_E`
   (`_tickets/migrate-confirmmodal-setwarning-to-setdestructive-when-minappversion-reaches-1130.md`),
   but a pre-existing OPEN ticket `nid_rv9wadneva15fs5ob0u3wp0x3_E`
   (`_tickets/replace-deprecated-setwarning-with-setdestructive-in-confirmmodal.md`,
   created 2026-07-20 in commit `019f04e`) already tracks the EXACT same
   `ConfirmModal.ts` `setWarning()→setDestructive()` migration gated on the same
   1.13.0 floor. Two open tickets for one unit of work violates the CLAUDE.md
   ticket-SRP guidance.
   *Fix:* close the new `nid_8lj046abp2q27ahfeqw0fi3nr_E` as a duplicate (or delete it)
   and, if the extra "same trigger as dropping display()" note has value, fold that
   into the existing `nid_rv9wadneva15fs5ob0u3wp0x3_E`. The `ConfirmModal.ts`
   `eslint-disable` WHY comment is fine as-is (references no ticket id).

### NIT
2. **Third copy of the "valid idle timeout" rule.** `SettingsSanitizer.sanitizeIdleTimeoutSeconds`
   (`src/settings.ts:40-44`) still encodes `Number.isInteger(v) && v >= MIN_IDLE_TIMEOUT_SECONDS`
   independently of the new `VisitHistorySettingTab.isValidIdleTimeoutSeconds`. The new
   predicate correctly DRYs the tab's two representations, but the load-boundary sanitizer
   is a third home for the same business rule (drift risk if MIN semantics change).
   *Fix (optional):* hoist the predicate into `settings.ts` next to the constants and have
   BOTH the sanitizer and the tab consume it. Note the dependency direction — `settingsTab`
   imports `settings`, not vice-versa — so the shared predicate belongs in `settings.ts`,
   not on the tab. Pareto-marginal; acceptable to leave.

3. **No test for the `setControlValue` persist+save path.** Tests cover the declarative
   data (structure + `validate` boundaries) and the group's render item well, but the one
   piece of actual runtime behavior added — `setControlValue` writing `settings[key]` and
   calling `saveSettings()` — is untested. A 1-case test (fake plugin with a spy
   `saveSettings`, assert the write + the call) would guard it cheaply. Low priority (thin
   method), but it is the only non-declarative logic in the change.

## Non-issues verified
- Boundary `as` cast is documented, minimal, and matches CLAUDE.md's "casts only at system boundaries". No POLS violation.
- `setControlValue` trusting post-`validate` values (no re-coercion) is per the API contract; `SettingsSanitizer` is the load-boundary backstop — no invalid-value hazard.
- obsidianMock stubs (`PluginSettingTab`/`Setting`/`Modal`) are minimal, test-only, hollow, and additive — existing exports untouched; all 38 suites still pass.
- `ConfirmModal.setWarning()` suppression is correctly scoped (`eslint-disable-next-line`), carries a clear WHY tied to the 1.5.7 floor, and is the genuine no-regression choice (`setDestructive()` is `@since 1.13.0` and would `TypeError` on <1.13). No cleaner alternative exists while keeping the floor.

## Documentation
No CLAUDE.md / docs update required — the declarative-vs-`display()` fallback is an internal
settings-tab detail already implicit in the settings-tab description. (If ticket #1 is
actioned, ensure only one open setWarning ticket remains.)
