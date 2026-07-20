# IMPLEMENTATION — private state

COMPLETE. All plan edits applied + 2 forced deviations (documented in PUBLIC). Gate green:
lint exit 0 (0 err / 2 pre-existing main.ts warnings), test 358/358, build 0. Working tree
uncommitted (TOP_LEVEL commits).

Files edited:
- src/core/focusDuration/FocusDurationTracker.ts  (interface+type, ctor 3rd arg, field types, 4 timer sites, 4 disables removed)
- src/core/focusDuration/FocusDurationTracker.test.ts  (import WindowTimers, fakeTimers in beforeEach)
- src/core/focusDuration/WindowActivityMonitor.test.ts  (NOT in plan — fakeTimers() helper, 3 ctor sites)
- src/core/focusTracker/listener/VhV3FocusDurationListener.test.ts  (NOT in plan — 3rd arg in setup())
- src/core/init/PluginFactory.ts  (rootSplit.win/doc, disable removed)
- src/core/util/env/DeviceNameProvider.ts  (window.localStorage ×2, describe os disable)
- src/core/service/visitHistoryService/user/UserNameProvider.ts  (window.localStorage ×2, describe os disable)

Two deviations vs plan (both forced, hack-free):
1. Fields declared `TimerHandle` not `TimerHandle | null` — `unknown | null` trips
   @typescript-eslint/no-redundant-type-constituents (hard error).
2. Plan §3.5 undercounted ctor call sites: WindowActivityMonitor.test.ts (×3) +
   VhV3FocusDurationListener.test.ts (×1) also construct the tracker; fixed with fake-clock-captured
   { setTimeout, clearTimeout } per §2.1 ordering.

Nothing left to do.
