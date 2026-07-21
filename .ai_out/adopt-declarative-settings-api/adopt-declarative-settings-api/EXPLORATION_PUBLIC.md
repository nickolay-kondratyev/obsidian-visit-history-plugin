# EXPLORATION_PUBLIC — Adopt declarative settings API in VisitHistorySettingTab

Ticket: `nid_apqgkqd35dmxuk6jqk6l7body_E`. Detailed context in sibling files:
- `EXPLORATION_CODEBASE.md` — current tab/settings/wiring/test-mock state (read this before coding).
- `EXPLORATION_API.md` — full obsidian 1.13 declarative API research (verbatim types from obsidian@1.13.1).

## The API (confirmed from obsidian@1.13.1 types)
- `getSettingDefinitions(): SettingDefinitionItem[]` on `PluginSettingTab` — **synchronous**, plural, `@since 1.13.0`. Called once on tab-add for **search indexing** and on every render.
- When it returns a **non-empty** array, the tab renders declaratively AND `display()` is **NOT called**. `display()` is `@deprecated Since 1.13.0`, kept as the pre-1.13 fallback. → **no double-render, no regression.**
- Numeric control: `SettingNumberControl { type:'number', key, defaultValue?, min?, max?, step?, placeholder?, validate? }`. Persistence is centralized on the tab via `getControlValue(key)`/`setControlValue(key,value)` (PluginSettingTab defaults read/write `plugin.settings`). **No per-control `onChange`.**
- **No button control** exists → the "Add ids" backfill button must use `SettingDefinitionRender` (`render: (setting) => setting.addButton(...)`), inside a `type:'group'` with `heading`.
- Installed types are **1.12.3** (lack the API). npm latest = **1.13.1**.

## CHOSEN DIRECTION (Approach B — keep display() fallback; do NOT change minAppVersion)
Rationale (Pareto + no owner decision needed + lint-consistent):
1. **Bump the dev dependency** `obsidian` → `^1.13.1` and reinstall so the types resolve. (Local type augmentation rejected — fragile, hand-copies ~10 interfaces.)
2. **Implement `getSettingDefinitions()`** returning: the `idleTimeoutSeconds` number control + a `type:'group'` (heading `'File modifying actions'`) whose item uses the `render` escape hatch for the existing "Add ids" button → `confirmAndRunDocIdBackfill()` (unchanged ConfirmModal + backfill flow).
3. **KEEP `display()` as-is** (the pre-1.13 fallback). Manifest `minAppVersion` stays `1.5.7` — bumping it to 1.13.0 would drop <1.13 users, a **product/owner decision NOT in scope**. Note the eslint `require-display` rule *requires* `display()` while `minAppVersion < 1.13.0`, so keeping it is also lint-consistent; `no-deprecated-display` only fires at `minAppVersion >= 1.13.0`.
4. **DRY**: extract the shared knowledge so `display()` and `getSettingDefinitions()` don't duplicate it — private static readonly copy constants (idle-timeout name/desc, backfill heading/name/desc/button label) + a shared `isValidIdleTimeoutSeconds(n)` predicate (used by display()'s onChange AND the declarative `validate`). Keep the two representations thin.
5. **Persistence**: override `setControlValue` to route through `plugin.saveSettings()` (single, explicit save path; boundary `as` cast acceptable). Only `idleTimeoutSeconds` is a control key. Live-apply works because `FocusDurationTracker` live-reads `settings.idleTimeoutSeconds`.
6. **Validation parity**: `validate: v => Number.isInteger(v) && v >= MIN ? undefined : 'Enter a whole number ≥ 5.'` — matches the current silent-reject (declarative shows an inline error instead — a minor UX improvement, not a regression). Also set `control.min`, `step:1`, `placeholder`.

## Testing (add where practical — CLAUDE.md notes wiring seam is untested)
- `src/testSupport/obsidianMock.ts` currently exports only `TAbstractFile/TFolder/TFile/normalizePath/Notice/Platform`. Add MINIMAL stubs needed to instantiate the tab + call `getSettingDefinitions()`: a `PluginSettingTab` base (stores app/plugin, `containerEl`), plus `Setting`/`Modal` stubs so module imports (tab imports `Setting`; ConfirmModal imports `Modal`) resolve. `getSettingDefinitions()` returns plain data and does NOT invoke Setting/render at call time — so it's testable directly.
- New `src/settingsTab/VisitHistorySettingTab.test.ts` (GIVEN/WHEN/THEN, one assert each): idle-timeout definition has correct `name`/`control.type:'number'`/`key:'idleTimeoutSeconds'`/`min`/`defaultValue`; `validate` rejects <5, rejects non-integer, accepts ≥5 integer; group heading `'File modifying actions'` present with a render item. Keep it focused; do NOT try to render the imperative UI.

## VERIFY (acceptance)
`npm run build` + `npm run lint` + `npm test` all green. Sentence-case UI text preserved (deliberate lowercase "ids"). Search discoverability is a manual check (1.13+).

## RISKS / STOP conditions
- Bumping obsidian types could ripple type/lint errors elsewhere. Implementer must resolve to green; if the bump causes broad unresolvable breakage → STOP + report (do NOT hack).
- `npm install` needs network; if the sandbox blocks it and the 1.13.1 types can't be fetched → that's a blocking env issue to report, NOT a reason to hand-augment types silently.
- Default `PluginSettingTab.setControlValue` persistence path is under-specified in the `.d.ts` — that's why we override it explicitly rather than relying on the default.
