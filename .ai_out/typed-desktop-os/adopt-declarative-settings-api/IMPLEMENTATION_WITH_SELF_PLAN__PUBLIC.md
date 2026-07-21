# Typed desktop-only `os` accessor (`DesktopOsInfo`) — for reviewer

## What changed
Extracted the duplicated Node-`os` access (hostname + OS user name) into ONE shared,
typed, mobile-safe utility. Both prior sites now delegate to it.

### Files
- **NEW** `src/core/util/env/DesktopOsInfo.ts` — static utility class (private ctor,
  per env/ conventions). Private generic `read<T>(reader)` does the guard + typed
  require once; `hostname(): string | null` and `userName(): string | null` are thin
  typed readers. `interface DesktopOsModule { hostname(); userInfo(): {username} }`.
- **NEW** `src/core/util/env/DesktopOsInfo.test.ts` — 5 tests.
- **EDIT** `src/core/util/env/DeviceNameProvider.ts` — `getDeviceName()` now calls
  `DesktopOsInfo.hostname()`; removed private `desktopHostname()` + `Platform` import.
- **EDIT** `src/core/service/visitHistoryService/user/UserNameProvider.ts` —
  `OsUserNameLookupDefault.getOsUserName()` now returns `DesktopOsInfo.userName()`;
  removed `Platform` import. The `OsUserNameLookup` interface/seam is KEPT (tests inject
  `FixedOsUserNameLookup`); only its Default impl now delegates.
- No `PluginFactory` / wiring changes.

Resolution behavior is byte-for-byte preserved: desktop hostname → device name;
`userInfo().username` → OS user name; mobile → null (callers fall back). The member CALL
stays inside the try/catch, matching the original catch-around-call semantics.

## The two findings and how each is eliminated AT THE SOURCE

### 1. no-unsafe-call / no-unsafe-member-access — fixed by TYPING (no disable)
`@types/node` is installed, so `require` is typed (`NodeJS.Require`). The require result is
bound to an explicit interface-typed const and members are called on the TYPED value:
```ts
const os = require("os") as DesktopOsModule;   // typed value, not any
return reader(os);                              // os.hostname() / os.userInfo().username
```
This is exactly the reviewer's recommended shape ("assign require result to a typed
local/const of an explicit interface shape, then call methods on the typed value"). No
`no-unsafe-*` disable is used or needed. Under the project's type-aware config
(`recommendedTypeChecked` + `projectService`), the affected lines are clean.

### 2. obsidianmd os-import rule — satisfied STRUCTURALLY (no disable)
**Rule investigated:** `eslint-plugin-obsidianmd` rule id **`no-nodejs-modules`**
(`dist/lib/rules/noNodejsModules.js`), message *"Do not import Node.js built-in module ...
Use a dynamic import() or require() guarded by Platform.isDesktop instead."*

**Acceptance logic (from source):** for a `require(builtin)` call it walks ancestors for a
guard. `isPlatformIsDesktop` requires the **literal identifier `Platform.isDesktop`**
(`property.name === "isDesktop"`) — it does **NOT** recognize `Platform.isDesktopApp`. It is
satisfied when the enclosing function STARTS with an early-exit guard
`if (!Platform.isDesktop) { return|throw }` (also accepts `if (Platform.isDesktop){…}`,
`Platform.isDesktop && …`, or a ternary). An inline eslint-disable of its own id does NOT
apply here (see below).

**Why not just disable it:** the rule is **not registered** in the installed
`eslint-plugin-obsidianmd@0.3.0` (orphan compiled file only; absent from the plugin's rules
map). Empirically, adding `// eslint-disable-next-line obsidianmd/no-nodejs-modules`
produces a hard LOCAL error: *"Definition for rule 'obsidianmd/no-nodejs-modules' was not
found."* So a disable for it would break `npm run lint`. The external review tool runs a
newer plugin version where the rule is active.

**Chosen resolution:** satisfy the rule structurally. `DesktopOsInfo.read()` begins with the
rule-recognized guard, then keeps the operative correctness guard:
```ts
if (!Platform.isDesktop) { return null; }      // rule-recognized; rules out mobile app
if (!Platform.isDesktopApp) { return null; }   // operative guard we behaviorally rely on
```
**Semantic note (per ticket):** `isDesktopApp` = the Electron desktop app where Node
builtins exist; `isDesktop` = desktop-sized (`!isMobile`). In Obsidian there is only a
desktop (Electron) app and a mobile app, so the two coincide, but `isDesktopApp` is the
semantically-correct guard for Node-builtin availability — it is **KEPT and remains the
operative check**; we did not weaken to `isDesktop`. The extra `isDesktop` guard is a true,
non-contradictory precondition (`isDesktopApp` ⟹ `isDesktop`) that also matches the
obsidianmd project's own recommended idiom. The `try/catch → null` remains the final
backstop.

The three inherent disables for the direct `require("os")` call are kept (genuinely used,
not unused-directive): `import/no-nodejs-modules`, `@typescript-eslint/no-require-imports`,
`no-undef`.

## Tests (`DesktopOsInfo.test.ts`, 5)
Mobile branch flips the mutable obsidian-mock `Platform` (restored in `afterEach`):
- hostname → null when mobile (`isDesktop=false,isDesktopApp=false`)
- userName → null when mobile
- hostname → null when desktop-sized but `isDesktopApp=false` (exercises the operative guard)
Desktop branch (real Node env under vitest):
- hostname → typeof string & non-empty (no exact value asserted)
- userName → typeof string & non-empty

## Verification (all captured to `.tmp/`)
- `npm run lint` → **exit 0**, 0 errors (only 2 pre-existing unrelated
  `obsidianmd/prefer-active-doc` warnings; identical to baseline). Targeted lint of the 4
  changed/new files → exit 0, zero problems.
- `npm run build` (`tsc -noEmit` + esbuild) → **exit 0**.
- `npm test` → **exit 0**, 39 files / 386 tests passed (incl. 5 new DesktopOsInfo tests;
  existing `UserNameProvider.test.ts` still green).

### External type-aware pass reasoning
Local ESLint DOES run type-aware rules (`recommendedTypeChecked` + `projectService`), so the
no-unsafe-* result above is authoritative, not merely a syntactic pass. `require` is typed
via `@types/node` (same tsconfig the external tool uses); the result is cast to an explicit
interface and members are called on the typed value — so the type-aware external pass sees
no `any` call/member-access on the affected lines. The obsidianmd os-import finding is
removed structurally (guarded by the literal `Platform.isDesktop` the rule matches), not via
a disable, so it will not re-fire on the newer plugin version the external tool runs.
