# IMPLEMENTATION — fix-obsidian-warnings

Scope implemented: B (Platform guard, 2 TS files) + E (2 CSS edits). Everything else DEFERRED and left untouched.

## Changes

### B — Guard Node `os` require with `Platform.isDesktopApp`
- `src/core/service/visitHistoryService/user/UserNameProvider.ts`
  - Added `import { Platform } from 'obsidian';` (line 1).
  - `OsUserNameLookupDefault.getOsUserName()` (~line 30): added `if (!Platform.isDesktopApp) { return null; }` as the FIRST statement, before the try/require. Existing try/catch + eslint-disable comment kept intact. Return type `string | null` unchanged.
- `src/core/util/env/DeviceNameProvider.ts`
  - Added `import { Platform } from 'obsidian';` (line 1).
  - `DeviceNameProviderDefault.desktopHostname()` (~line 33): added `if (!Platform.isDesktopApp) { return null; }` as the FIRST statement, before the try/require. Existing try/catch + eslint-disable comment kept intact. Return type `string | null` unchanged.
- Behavior-preserving: mobile already returned null via the catch; now it returns null explicitly before touching `require`.

### Test-support (supporting change for B)
- `src/testSupport/obsidianMock.ts`: added a `Platform` export (`{ isDesktopApp: true, isMobileApp: false, isMobile: false, isDesktop: true }`) so the `import { Platform } from 'obsidian'` in the two production files resolves at runtime under the vitest `obsidian` alias. Defaulted to desktop to match the environment tests emulate. No new/changed test cases — existing `UserNameProvider.test.ts` injects a fake `OsUserNameLookup` (`FixedOsUserNameLookup`) and never exercises the real `Platform` branch; a dedicated non-desktop test would require flipping the mock and adds no coverage of unchanged behavior (deliberately skipped to avoid over-engineering). `DeviceNameProvider` has no existing test file.

### E — CSS (styles.css)
- ~line 282: added sibling rule after `.filter-chips`:
  `.vault-heatmap-view .filter-chips::-webkit-scrollbar { display: none; }` — purely additive WebKit fallback for `scrollbar-width: none`.
- ~line 886: removed ONLY the `!important` from `.vault-heatmap-view .tt-null { color: var(--vt-text-dim); font-style: italic; }` (redundant per cascade — `.tt-null` declared after `.tt-val` at equal specificity, elements carry both classes).

## Gate results
- `npm run build` (tsc -noEmit + esbuild production): PASS (exit 0), clean.
- `npm run lint`: PASS — 0 errors, 2 warnings (both pre-existing `obsidianmd/prefer-active-doc` at main.ts:133,137 — out of scope). No new warnings.
- `npm test`: PASS — 37 test files, 358 tests, all passing.

## Deferred items — confirmed UNTOUCHED
- Category A (`no-unsafe-*` sites): no code changes (bot CI/submodule artifact; fully typed locally).
- `src/settingsTab/VisitHistorySettingTab.ts` (declarative settings / getSettingDefinitions): untouched.
- `ConfirmModal.ts` (`setWarning` → `setDestructive`): untouched (would break Obsidian <1.13.0; minAppVersion 1.5.7).

## Deviations
- One deviation from the literal "2 files" B scope: also added `Platform` to `obsidianMock.ts` (test-support), required so the new production import resolves under the vitest alias. Non-production; keeps the suite green.
