# IMPLEMENTATION_WITH_SELF_PLAN — Adopt declarative settings API

Ticket: `nid_apqgkqd35dmxuk6jqk6l7body_E`. Approach B from `EXPLORATION_PUBLIC.md`
(keep `display()` fallback; do NOT change `minAppVersion`). DONE — all gates green.

## Plan (executed)
1. Bump `obsidian` dev dep `latest → ^1.13.1`, reinstall (`--ignore-scripts`) so 1.13 types resolve.
2. Add `getSettingDefinitions()` to `VisitHistorySettingTab` (number control + group w/ render button).
3. Override `setControlValue()` to route through `plugin.saveSettings()`.
4. Keep `display()` as pre-1.13 fallback; DRY both via shared copy constants + `isValidIdleTimeoutSeconds`.
5. Extend the obsidian test mock; add a focused test for the definitions.

## Files changed (why)
- **`package.json`** — `"obsidian": "latest" → "^1.13.1"` (installed tree was pinned 1.12.3, lacks the API). `package-lock.json` updated by the reinstall.
- **`src/settingsTab/VisitHistorySettingTab.ts`** — the feature:
  - `getSettingDefinitions(): SettingDefinitionItem[]` → `[ number control (key `idleTimeoutSeconds`, `defaultValue`, `min`, `step:1`, `placeholder`, `validate`), group `heading:'File modifying actions'` with one `render` item wiring the existing `confirmAndRunDocIdBackfill()` button ]`.
  - `setControlValue(key,value)` override → mutate `settings[key]` (boundary `as unknown as Record<string,unknown>`) + `saveSettings()`. Single explicit save path.
  - `static isValidIdleTimeoutSeconds(seconds)` predicate — used by BOTH the declarative `validate` AND `display()`'s `onChange` (DRY, no drift).
  - Private static readonly copy constants (idle name/desc/error, backfill heading/name/desc/button label) shared by both representations. Exact original strings preserved (deliberate lowercase "ids", em dash, `≥`).
  - `display()` KEPT unchanged in behavior (now reads the shared constants/predicate). `../main` import switched to `import type` (+ `DocIdBackfillService`/`UserNotifier`/`DocIdBackfillResult` to `import type`) so the tab module loads under the vitest mock without pulling `main.ts` (which extends the un-mocked `Plugin`).
- **`src/testSupport/obsidianMock.ts`** — added minimal test-only stubs: `PluginSettingTab` (stores app/plugin, hollow `containerEl.empty()`), chainable no-op `Setting`, `Modal` (for the `ConfirmModal` import). Existing exports untouched.
- **`src/settingsTab/VisitHistorySettingTab.test.ts`** (NEW) — 13 vitest cases, GIVEN/WHEN/THEN, one assert each: predicate (reject <5 / non-integer, accept min); definitions (idle name, control `type`/`key`/`min`/`defaultValue`, `validate` reject/accept, group heading, render item present). Calls `getSettingDefinitions()` directly (plain data — no imperative render).
- **`src/settingsTab/ConfirmModal.ts`** — NOT part of the feature, but the dep bump surfaced a NEW deprecation error (see Deviation).

## Key decisions / deviations
- **`ConfirmModal.setWarning()` deprecation (dep-bump fallout).** obsidian 1.13.1 marks `ButtonComponent.setWarning()` `@deprecated` in favor of `setDestructive()` — but `setDestructive()` is `@since 1.13.0` and `manifest.json minAppVersion` is `1.5.7`, so switching would crash the confirm dialog on Obsidian < 1.13. Resolution: keep `setWarning()`, add a targeted `eslint-disable-next-line @typescript-eslint/no-deprecated` with a WHY tied to the version floor (mirrors why `display()` is kept). This is the no-regression choice, not a hack. Follow-up ticket `nid_8lj046abp2q27ahfeqw0fi3nr_E` (chore) tracks the migration for when the floor is raised to 1.13.0.
- **Persistence override, not default.** The `.d.ts` under-specifies `PluginSettingTab.setControlValue`'s default persistence; overriding to `plugin.saveSettings()` is explicit and reuses the existing single save path. Live-apply works because `FocusDurationTracker` live-reads `settings.idleTimeoutSeconds`.
- **`import type` for `../main`** — avoids loading `main.ts` (extends un-mocked `Plugin`) when the tab module is imported by the test.
- No `manifest.json` / `versions.json` change (out of scope — product decision to keep the 1.5.7 floor).

## VERIFY — final status (verbatim)
- `npm run build` → **PASS** (`BUILD_EXIT=0`; `tsc -noEmit -skipLibCheck` + esbuild production, no errors).
- `npm run lint` → **PASS** (`LINT_EXIT=0`; `0 errors`, 2 pre-existing warnings in `src/main.ts` `obsidianmd/prefer-active-doc` — untouched, already ticketed).
- `npm test` → **PASS** (`TEST_EXIT=0`; `Test Files 38 passed (38)`, `Tests 379 passed (379)` — +13 new).

Search discoverability (settings appear in Obsidian 1.13+ search) is a manual check on a real 1.13+ vault; not automatable here.
