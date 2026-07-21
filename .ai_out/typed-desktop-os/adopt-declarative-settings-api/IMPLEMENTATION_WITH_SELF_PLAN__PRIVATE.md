# PRIVATE memory — typed desktop-only `os` accessor

## Goal
Extract ONE shared typed, mobile-safe `DesktopOsInfo` (src/core/util/env/) for Node `os`
access. Eliminate 2 external-review findings at source: obsidianmd os-import rule +
no-unsafe-call/member-access. Keep exact resolution behavior + isDesktopApp guard.

## KEY INVESTIGATION FACTS (decide the pattern)
- obsidianmd rule = `noNodejsModules.js` (msg "Do not import Node.js built-in module...").
  Its guard check `isPlatformIsDesktop` requires the LITERAL identifier `Platform.isDesktop`
  (property.name==="isDesktop"). It does NOT recognize `isDesktopApp`.
  Accepts require guarded by early-exit `if (!Platform.isDesktop){return/throw}` at FUNCTION
  START (hasGuardAtFunctionStart), or `if(Platform.isDesktop){...}`, or `&&`/ternary.
- That rule is NOT registered in installed eslint-plugin-obsidianmd v0.3.0 (orphan dist file
  only; plugin.rules map lacks it). EXTERNAL tool runs a newer version.
- EMPIRICAL PROBE: adding `// eslint-disable-next-line obsidianmd/no-nodejs-modules` →
  LOCAL ERROR "Definition for rule 'obsidianmd/no-nodejs-modules' was not found".
  => disable approach BREAKS local lint. FORBIDDEN.
- `@types/node` installed → `require` typed as NodeJS.Require (returns any). So
  `const os = require("os") as Iface` gives a TYPED value → no no-unsafe-call/member-access.
  Direct `require("os")` call still needs disables: import/no-nodejs-modules,
  @typescript-eslint/no-require-imports, no-undef (all genuinely used; not unused-directive).

## DECISION
- Satisfy obsidianmd rule STRUCTURALLY: private helper `read()` whose FIRST statement is
  `if (!Platform.isDesktop){return null;}` (rule-recognized), FOLLOWED by
  `if (!Platform.isDesktopApp){return null;}` (the operative correctness guard — kept).
  Both true on desktop; isDesktopApp is what we behaviorally rely on. NO disable for the
  obsidianmd rule (can't — unregistered locally).
- Fix no-unsafe-*: `const os = require("os") as DesktopOsModule;` typed const, call members
  on it. Keep the 3 honest disables inherent to require().
- require + the member CALL both inside try/catch (preserve original catch-around-call
  behavior — original wrapped `.hostname()`/`.userInfo()` in try).

## Files
- NEW src/core/util/env/DesktopOsInfo.ts (static util class, private ctor).
- NEW src/core/util/env/DesktopOsInfo.test.ts.
- EDIT DeviceNameProvider.ts: getDeviceName → DesktopOsInfo.hostname(); drop desktopHostname()
  + Platform import.
- EDIT UserNameProvider.ts: OsUserNameLookupDefault.getOsUserName → DesktopOsInfo.userName();
  drop Platform import (keep OsUserNameLookup seam/interface — tested via FixedOsUserNameLookup).
- No PluginFactory change.

## Verify cmds (output → .tmp/)
- npm run lint  (baseline: 0 errors, 2 pre-existing prefer-active-doc warnings)
- npm run build
- npm test

## STATUS: DONE — all verifications green
- npm run lint → exit 0 (0 errors; 2 pre-existing prefer-active-doc warnings, == baseline)
- targeted lint of 4 files → exit 0, zero problems
- npm run build → exit 0
- npm test → exit 0, 39 files / 386 tests (5 new DesktopOsInfo tests pass)
- Empirically re-confirmed: disable of unregistered obsidianmd rule = local ERROR → chose
  structural guard instead. Kept isDesktopApp as operative guard.
- No PluginFactory changes. OsUserNameLookup seam kept (tests unaffected).
