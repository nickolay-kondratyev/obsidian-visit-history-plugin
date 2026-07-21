# EXPLORATION — Typed desktop-only `os` accessor (`DesktopOsInfo`)

## The two `os`-access blocks (exact current content)

### `src/core/util/env/DeviceNameProvider.ts` (hostname / device name)
- Import (line 1): `import { Platform } from 'obsidian';`
- Method lines 30-47 — `private static desktopHostname(): string | null`:
```ts
    if (!Platform.isDesktopApp) {
      return null;
    }
    try {
      // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports, no-undef -- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile
      return (require("os") as { hostname(): string }).hostname();
    } catch {
      return null;
    }
```
- Double-quote `require("os")`. Consumed line 23: `DeviceNameProviderDefault.desktopHostname() ?? "mobile-" + crypto.randomUUID().slice(0, 8)`.
- Public: `DeviceNameProvider.getDeviceName(): string`. No injectable `os` seam today (`desktopHostname` is `private static`).

### `src/core/service/visitHistoryService/user/UserNameProvider.ts` (userInfo().username)
- Import (line 1): `import { Platform } from 'obsidian';`
- Lines 21-44:
```ts
export interface OsUserNameLookup {
  getOsUserName(): string | null;
}

export class OsUserNameLookupDefault implements OsUserNameLookup {
  getOsUserName(): string | null {
    if (!Platform.isDesktopApp) {
      return null;
    }
    try {
      // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports, no-undef -- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile
      return (require('os') as { userInfo(): { username: string } }).userInfo().username;
    } catch {
      return null;
    }
  }
}
```
- Single-quote `require('os')`. Consumed line 100: `const osUserName = this.osUserNameLookup.getOsUserName();`.
- `OsUserNameLookupDefault` is injected as default param (line 88): `private readonly osUserNameLookup: OsUserNameLookup = new OsUserNameLookupDefault()`.

Both blocks share the IDENTICAL eslint-disable line + `Platform.isDesktopApp` guard + `try/catch → null` shape. Cast shapes differ only by member accessed.

## Platform
- Imported only in these two files, both `import { Platform } from 'obsidian';`, used only as `Platform.isDesktopApp`. `Platform.isDesktop` also exists in the mock (unused in prod).

## Conventions in `src/core/util/env/`
- Currently contains ONLY `DeviceNameProvider.ts` (no test there).
- Style: `interface X` + `class XDefault implements X`. Static-utility precedent: `UserNameSafety` (static methods). `DesktopOsInfo` as a **static utility class** (no state, pure system-boundary read) is the closest precedent; interface+Default also acceptable.

## Wiring (`src/core/init/PluginFactory.ts`)
- L9 import DeviceNameProvider; L81 `new DeviceNameProviderDefault()` (no-arg).
- L26 import UserNameProvider; L84 `new UserNameProviderDefault(this.hiddenFileUtil, this.modalUserNamePrompt)` — relies on `OsUserNameLookupDefault` default param.
- `deviceNameProvider` → `VhV3DurationRecorder` (L133). **No constructor changes needed** if `DesktopOsInfo` is delegated to internally.

## Tests & mocking
- `UserNameProvider.test.ts`: injects `FixedOsUserNameLookup implements OsUserNameLookup` — never touches real `os`/`Platform`.
- NO test for `DeviceNameProviderDefault`. Faked via `FixedDeviceNameProvider` in `src/testSupport/fakes.ts:67-74`.
- `src/testSupport/obsidianMock.ts:39-49`: `Platform` is a **mutable** object (`isDesktopApp: true, isMobileApp: false, isMobile: false, isDesktop: true`), comment says "Mutable so a test can flip it if needed." Tests CAN set `Platform.isDesktopApp = false` (restore in `afterEach` — shared singleton). No test currently does.
- vitest runs in Node, so real `require('os')` works — desktop-branch test would read real hostname/username (non-deterministic). Prefer asserting the **mobile→null branch** by toggling `Platform.isDesktopApp = false`; for desktop branch, assert it returns a non-null string (or delegate-called), not an exact value.

## ESLint (`eslint.config.mts`)
- `typescript-eslint` + `eslint-plugin-obsidianmd` (`obsidianmd.configs.recommended`) + browser globals. No custom rule overrides.
- Inline-disabled rules at the require: `import/no-nodejs-modules`, `@typescript-eslint/no-require-imports`, `no-undef`.
- NOTE: `no-unsafe-*` are **type-aware** rules; local `npm run lint` may not run type-checked linting, which is why local lint is clean but the external review tool (type-aware) flags no-unsafe-*. **The external obsidianmd mobile os-import rule and no-unsafe-* are the findings to eliminate at the SOURCE (not via disable).**

## Precedent
- Only typed-require precedent in repo is these two sites. No dynamic `import()` elsewhere. `tsconfig` `moduleResolution: node`.

## Suggested shape (preserve EXACT behavior)
New `src/core/util/env/DesktopOsInfo.ts` exposing two mobile-safe reads:
- `deviceHostname(): string | null` → hostname
- `osUserName(): string | null` → userInfo().username

`DeviceNameProviderDefault.desktopHostname()` and `OsUserNameLookupDefault.getOsUserName()` delegate to it. No PluginFactory changes.

## Key file:line refs
- `src/core/util/env/DeviceNameProvider.ts:1,23,30-47`
- `src/core/service/visitHistoryService/user/UserNameProvider.ts:1,21-44,88,100`
- `src/core/init/PluginFactory.ts:9,26,58,81,84,133`
- `src/core/service/visitHistoryService/user/UserNameProvider.test.ts:6-13,38-46`
- `src/testSupport/obsidianMock.ts:39-49`
- `src/testSupport/fakes.ts:67-74`
- `eslint.config.mts:42`
- `vitest.config.ts:6-9`
