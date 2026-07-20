# IMPLEMENTATION — PRIVATE state (rehydration)

## Status: COMPLETE. All gates green. Not committed (TOP_LEVEL handles commits).

## What was done (B + E only)
Files edited (all in working tree, uncommitted):
1. `src/core/service/visitHistoryService/user/UserNameProvider.ts`
   - line 1: `import { Platform } from 'obsidian';`
   - `OsUserNameLookupDefault.getOsUserName()`: first stmt `if (!Platform.isDesktopApp) { return null; }` before try/require. try/catch + eslint-disable KEPT.
2. `src/core/util/env/DeviceNameProvider.ts`
   - line 1: `import { Platform } from 'obsidian';`
   - `desktopHostname()`: first stmt `if (!Platform.isDesktopApp) { return null; }` before try/require. try/catch + eslint-disable KEPT.
3. `src/testSupport/obsidianMock.ts`
   - Added `export const Platform = { isDesktopApp: true, isMobileApp: false, isMobile: false, isDesktop: true };`
   - Needed because prod files now `import { Platform } from 'obsidian'` and vitest aliases obsidian → this mock. Prior mock lacked Platform.
4. `styles.css`
   - After `.vault-heatmap-view .filter-chips { ... }` (~line 281): added `.vault-heatmap-view .filter-chips::-webkit-scrollbar { display: none; }`.
   - `.vault-heatmap-view .tt-null`: removed `!important` from color line.

## Gate results (last run)
- build: exit 0.
- lint: exit 0 — 0 errors, 2 pre-existing warnings (main.ts:133,137 prefer-active-doc). No new.
- test: 37 files / 358 tests passing.

## Test decision
- Did NOT add a "returns null on non-desktop" test. `UserNameProvider.test.ts` uses `FixedOsUserNameLookup` fake — never hits real `OsUserNameLookupDefault`/`Platform`. `DeviceNameProvider` has no test file. Adding one needs flipping the mock Platform + tests unchanged behavior only. Skipped per anti-over-engineering. Mock Platform is mutable if a future test needs it.

## Deferred (NOT touched — per instructions, TOP_LEVEL owns tickets)
- Category A no-unsafe-* (bot submodule artifact).
- VisitHistorySettingTab.ts declarative settings API.
- ConfirmModal.ts setWarning→setDestructive.

## If re-run: nothing left to do. Verify gates only.
