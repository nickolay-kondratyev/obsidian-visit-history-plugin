# Exploration: "Minimum focus time before a visit is recorded" + FocusDurationSink decorator

Goal of the ticket: add a `minFocusSecondsToRecord` setting (mirroring the existing
`idleTimeoutSeconds` idle-timeout setting end-to-end) plus a decorator
`FocusDurationSink` (`FocusDurationSink`-implementing wrapper, tentatively
`FocusDurationSink`/`FocusDurationSink`) that drops sessions whose `durationMs`
is below the configured minimum before delegating to the real recorder.

The idle-timeout setting is the PATTERN to mirror throughout. Below, each
relevant file is summarized with exact signatures and insertion points.

Test naming convention: colocated `Foo.ts` -> `Foo.test.ts` next to it.
Unit tests run via `npm test` (`vitest run`), include glob
`src/**/*.test.ts(x)` (see vitest.config.ts). E2E via `npm run test:e2e`
(Playwright, `e2e/*.e2e.ts`).

---

## 1. `src/settings.ts` (FULL current content)

This is the single source of truth for the pattern. Everything for
`minFocusSecondsToRecord` mirrors the idle-timeout members here.

```ts
import { HeatmapConfig, HeatmapConfigSanitizer } from './viewModel/heatmapConfig';

/**
 * Seconds without any user interaction before the focused document's V3
 * duration session is auto-closed ...  3 minutes by default.
 */
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 180;

/**
 * Floor for the idle timeout. ...
 */
export const MIN_IDLE_TIMEOUT_SECONDS = 5;

/**
 * Single source of truth for the idle-timeout validity rule. Consumed by BOTH
 * the load boundary (SettingsSanitizer) and the settings tab ...
 */
export class IdleTimeoutSeconds {
  /** Whether a candidate idle-timeout is a whole number at or above the minimum. */
  static isValid(seconds: number): boolean {
    return Number.isInteger(seconds) && seconds >= MIN_IDLE_TIMEOUT_SECONDS;
  }
}

export interface VisitHistoryPluginSettings {
  idleTimeoutSeconds: number;
  heatmap: HeatmapConfig;
}

export class SettingsSanitizer {
  static sanitize(loadedData: unknown): VisitHistoryPluginSettings {
    const raw = (loadedData ?? {}) as Partial<Record<keyof VisitHistoryPluginSettings, unknown>>;
    return {
      idleTimeoutSeconds: SettingsSanitizer.sanitizeIdleTimeoutSeconds(raw.idleTimeoutSeconds),
      heatmap: HeatmapConfigSanitizer.sanitize(raw.heatmap),
    };
  }

  private static sanitizeIdleTimeoutSeconds(value: unknown): number {
    return typeof value === 'number' && IdleTimeoutSeconds.isValid(value)
      ? value
      : DEFAULT_IDLE_TIMEOUT_SECONDS;
  }
}
```

### What to add for `minFocusSecondsToRecord` (mirror exactly)
- New consts near the top (values are a product decision — pick sensible ones,
  e.g. `DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD` and a floor const like
  `MIN_MIN_FOCUS_SECONDS_TO_RECORD`). NOTE: a value of 0 (record everything)
  is a plausible valid minimum for THIS setting — decide whether the floor is 0
  or 1. The idle floor is 5 for a state-machine reason that does NOT apply here.
- New rule class mirroring `IdleTimeoutSeconds`, e.g.
  `class MinFocusSecondsToRecord { static isValid(seconds: number): boolean { ... } }`
  (likely `Number.isInteger(seconds) && seconds >= <floor>`).
- Add `minFocusSecondsToRecord: number;` to `VisitHistoryPluginSettings`.
- Add a `sanitizeMinFocusSecondsToRecord` private static and wire it into
  `SettingsSanitizer.sanitize`'s returned object (mirror
  `sanitizeIdleTimeoutSeconds`).

---

## 2. `src/settings.test.ts` — test structure to mirror

Two top-level `describe` blocks:
- `describe('IdleTimeoutSeconds', () => { describe('isValid', ...) })` with 3
  tests: reject below min, reject non-integer, accept the minimum. Uses
  `MIN_IDLE_TIMEOUT_SECONDS` +/- offsets.
- `describe('SettingsSanitizer', () => { describe('sanitize', ...) })` with
  tests: defaults when `null` (fresh install); keep a valid persisted value
  (600); keep the exact minimum (boundary); fall back on non-numeric string
  (`'abc'`); fall back below minimum (0); fall back on non-integer (7.5); fall
  back when key missing (`{}`); heatmap-delegation tests.

Style: GIVEN/WHEN/THEN comments, `expect(...).toBe(...)`. Imports pull the
consts + classes from `./settings`. Mirror a parallel block for the new setting
(and add `minFocusSecondsToRecord` assertions to any existing sanitize tests as
needed — currently they only assert `idleTimeoutSeconds`/`heatmap`).

---

## 3. `src/core/config/ConfigProvider.ts` — full

```ts
import { DevConfigOverrides } from './DevConfigOverridesReader';

export interface ConfigProvider {
  /** The idle timeout in milliseconds to use RIGHT NOW. Read live ... */
  getIdleTimeoutMs(): number;
}

export interface ConfigSettingsHost {
  readonly settings: { readonly idleTimeoutSeconds: number };
}

export class ConfigProviderDefault implements ConfigProvider {
  constructor(
    private readonly host: ConfigSettingsHost,
    private readonly overrides: DevConfigOverrides,
  ) {}

  getIdleTimeoutMs(): number {
    const override = this.overrides.idleTimeoutSeconds;
    if (override !== undefined && Number.isFinite(override) && override > 0) {
      return override * 1000;
    }
    return this.host.settings.idleTimeoutSeconds * 1000;
  }
}
```

### To mirror for the new setting
- Add `getMinFocusMsToRecord(): number;` (or `...Seconds`) to the `ConfigProvider`
  interface.
- Add `minFocusSecondsToRecord: number` to `ConfigSettingsHost.settings`.
- Add a `getMinFocusMsToRecord()` impl. Dev-override wiring is OPTIONAL — the
  idle timeout has a dev override because e2e needs a sub-floor value; whether
  the new setting needs one depends on whether an e2e wants a sub-floor min.
  If added, extend `DevConfigOverrides` (see below) and mirror the
  present/finite/`> 0` guard. Note: for a "minimum" a `0` override is a legit
  value, so the `> 0` sentinel used by idle timeout may not translate directly —
  consider `undefined`-check only.

`VisitHistoryPlugin` (main.ts) structurally satisfies `ConfigSettingsHost` via
its `settings` object; the provider is constructed in PluginFactory (see 7).

`src/core/config/DevConfigOverridesReader.ts` — `DevConfigOverrides` interface
currently: `{ readonly idleTimeoutSeconds?: number }`. `parse()` narrows each
consumed key by `typeof === 'number'`. Add `minFocusSecondsToRecord?` here AND
in `parse()` if a dev override is wanted. Env var name lives in
`src/core/config/DevOverridesFileSource.ts`:
`DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR = '__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__'`
(duplicated in `e2e/constants.ts`).

---

## 4. `src/core/config/ConfigProvider.test.ts` — patterns to mirror

Helper: `function makeHost(idleTimeoutSeconds: number): ConfigSettingsHost & {...}`
returns `{ settings: { idleTimeoutSeconds } }`. If `ConfigSettingsHost` gains a
field, this helper must supply it too.

`describe(ConfigProviderDefault.name, () => describe('getIdleTimeoutMs', ...))`
tests: setting->ms when no override; override->ms; sub-floor override honored
(not re-clamped); fall back when override is 0 / negative / NaN; live settings
change reflected (mutate `host.settings.idleTimeoutSeconds` then re-read).
Mirror an analogous `describe('getMinFocusMsToRecord')` block.

Related tests exist: `DevConfigOverridesReader.test.ts`,
`DevOverridesFileSource.test.ts` (update if `DevConfigOverrides` gains a key).

---

## 5. `src/core/focusDuration/FocusDurationTracker.ts` — sink interface

Exact sink interface (the seam the decorator implements + wraps):

```ts
/** Receives completed focus sessions. Implementations must never throw. */
export interface FocusDurationSink {
  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void;
}
```

Usage inside the tracker: `this.sink.recordFocusDuration(docId, startMs, Math.max(0, effectiveEndMs - startMs));`
(in `endSession`, line 261). The tracker is constructed with
`constructor(private readonly sink: FocusDurationSink, private readonly getIdleTimeoutMs: IdleTimeoutMsProvider, private readonly timers: WindowTimers)`.

`IdleTimeoutMsProvider = () => number` (a live getter). Zero-duration sessions
ARE emitted as `D:0` today (pass-through navigation recorded truthfully). The
decorator's job: drop a record when `durationMs < minFocusMs`.

The tracker itself does NOT need changes — the decorator wraps the sink passed
into it. (The min-focus gate lives in the sink layer, not the state machine.)

### Decorator to create (mirrors `RecordingSink`/`VhV3DurationRecorder` shape)
New file `src/core/focusDuration/FocusDurationSink.ts`? — actually the interface
already lives in `FocusDurationTracker.ts`. Create e.g.
`src/core/focusDuration/MinFocusDurationSink.ts` (name TBD) implementing
`FocusDurationSink`, constructor taking `(delegate: FocusDurationSink,
getMinFocusMs: () => number)` and forwarding only when
`durationMs >= getMinFocusMs()`. Provide a colocated
`MinFocusDurationSink.test.ts`.

Test-fake pattern (from `FocusDurationTracker.test.ts`):
```ts
class RecordingSink implements FocusDurationSink {
  readonly records: RecordedSession[] = [];
  recordFocusDuration(docId, focusStartEpochMs, durationMs): void {
    this.records.push({ docId, focusStartEpochMs, durationMs });
  }
}
```
Use a live mutable `let minFocusMs` + `() => minFocusMs` getter to prove the
threshold is read live (mirror the tracker test's `let idleTimeoutMs`).

---

## 6. `src/core/focusDuration/VhV3DurationRecorder.ts` — the sink to wrap

```ts
export class VhV3DurationRecorder implements FocusDurationSink {
  private writeChain: Promise<void> = Promise.resolve();
  constructor(
    private readonly vhV3DurationStore: VhV3DurationStore,
    private readonly lastVisitCache: LastVisitCache,
    private readonly deviceNameProvider: DeviceNameProvider,
    private readonly userName: string,   // pinned user name
  ) {}
  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void { ... }
  flush(): Promise<void> { return this.writeChain; }
}
```

This is the concrete `FocusDurationSink` the decorator wraps. NOTE `flush()` is
NOT part of the `FocusDurationSink` interface — it is called by PluginFactory
via the tracker's `dispose()` path indirectly (actually tracker.dispose() flushes
sessions; recorder.flush is used in tests/unload). If the decorator must expose
`flush()`, note that PluginFactory does not currently call `recorder.flush()`
directly (only `focusDurationTracker.dispose()`), so the decorator can be a pure
`FocusDurationSink` with no `flush()`.

Recorder test (`VhV3DurationRecorder.test.ts`) uses `FakeHiddenFileUtil` +
`FixedDeviceNameProvider` (from `src/testSupport/`), asserts on-disk line format
`'<ISO> D:<millis>\n'`, and `await recorder.flush()` between act and assert.

---

## 7. `src/core/init/PluginFactory.ts` — wiring insertion point

`configProvider` is a public readonly field, constructed in the ctor:
```ts
const devOverrides = new DevConfigOverridesReader(new DevOverridesFileSourceDefault()).overrides;
this.configProvider = new ConfigProviderDefault(plugin, devOverrides);
```
(`plugin` = the `VisitHistoryPlugin`, satisfies `ConfigSettingsHost`.)

The exact tracker wiring lives in `activateUserScopedRecording(userName: string)`
(lines 142-148):
```ts
this.focusDurationTracker = new FocusDurationTracker(
  new VhV3DurationRecorder(this.vhV3DurationStore, this.lastVisitCache, this.deviceNameProvider, userName),
  // Effective idle timeout via the config seam ...
  () => this.configProvider.getIdleTimeoutMs(),
  mainWindow,
);
```

### Change to make
Wrap the `VhV3DurationRecorder` in the new decorator, passing a live getter:
```ts
this.focusDurationTracker = new FocusDurationTracker(
  new MinFocusDurationSink(
    new VhV3DurationRecorder(this.vhV3DurationStore, this.lastVisitCache, this.deviceNameProvider, userName),
    () => this.configProvider.getMinFocusMsToRecord(),
  ),
  () => this.configProvider.getIdleTimeoutMs(),
  mainWindow,
);
```
Add the import for the decorator alongside the existing
`import { VhV3DurationRecorder } from '../focusDuration/VhV3DurationRecorder';`.
`this.configProvider` is already stored and available here.

---

## 8. `src/settingsTab/VisitHistorySettingTab.ts` — settings-tab pattern

Shared copy constants (private static) at top of class:
```ts
private static readonly IDLE_TIMEOUT_NAME = 'Idle timeout (seconds)';
private static readonly IDLE_TIMEOUT_DESC = 'Seconds without any interaction ... '
    + `Minimum ${MIN_IDLE_TIMEOUT_SECONDS}; default ${DEFAULT_IDLE_TIMEOUT_SECONDS} (3 minutes). Applies immediately.`;
private static readonly IDLE_TIMEOUT_ERROR = `Enter a whole number >= ${MIN_IDLE_TIMEOUT_SECONDS}.`;
```
Imports: `import { DEFAULT_IDLE_TIMEOUT_SECONDS, IdleTimeoutSeconds, MIN_IDLE_TIMEOUT_SECONDS } from '../settings';`

### (a) Declarative control (Obsidian 1.13+), in `getSettingDefinitions()`:
```ts
{
  name: VisitHistorySettingTab.IDLE_TIMEOUT_NAME,
  desc: VisitHistorySettingTab.IDLE_TIMEOUT_DESC,
  control: {
    type: 'number',
    key: 'idleTimeoutSeconds',
    defaultValue: DEFAULT_IDLE_TIMEOUT_SECONDS,
    min: MIN_IDLE_TIMEOUT_SECONDS,
    step: 1,
    placeholder: String(DEFAULT_IDLE_TIMEOUT_SECONDS),
    validate: (value) => IdleTimeoutSeconds.isValid(value)
      ? undefined
      : VisitHistorySettingTab.IDLE_TIMEOUT_ERROR,
  },
},
```
Return array also has a `type: 'group'` (the backfill "File modifying actions").
Add the new setting object as a second entry BEFORE the group (or wherever
appropriate).

`setControlValue(key, value)` persists declaratively — it writes
`(settings as Record<string, unknown>)[key] = value` then `await saveSettings()`.
Its comment says "`idleTimeoutSeconds` is the only key" — UPDATE that comment;
the generic body already handles any new key, so no logic change needed.

### (b) Imperative fallback (`display()` + `displayIdleTimeoutSetting()`):
```ts
display(): void {
  this.containerEl.empty();
  this.displayIdleTimeoutSetting();
  // ... backfill heading + button
}

private displayIdleTimeoutSetting(): void {
  new Setting(this.containerEl)
    .setName(VisitHistorySettingTab.IDLE_TIMEOUT_NAME)
    .setDesc(VisitHistorySettingTab.IDLE_TIMEOUT_DESC)
    .addText(text => text
      .setPlaceholder(String(DEFAULT_IDLE_TIMEOUT_SECONDS))
      .setValue(String(this.visitHistoryPlugin.settings.idleTimeoutSeconds))
      .onChange(async (value) => {
        const seconds = Number(value);
        if (!IdleTimeoutSeconds.isValid(seconds)) { return; }
        this.visitHistoryPlugin.settings.idleTimeoutSeconds = seconds;
        await this.visitHistoryPlugin.saveSettings();
      }));
}
```
### To mirror
Add `MIN_FOCUS_*` copy constants, a new declarative control entry keyed
`minFocusSecondsToRecord` (with `validate` using the new rule class), and a new
`private displayMinFocusSetting()` called from `display()`. There is no settings
tab unit test file (VisitHistorySettingTab has no `.test.ts`).

---

## 9. e2e layer

### `e2e/obsidianHarness.ts`
- `interface LaunchOptions { readonly idleTimeoutSeconds: number; readonly devConfigOverrides?: DevConfigOverrides; }`
- `interface DevConfigOverrides { readonly idleTimeoutSeconds?: number; }` (node-side
  duplicate of the src one).
- `data.json` written before enable (lines 71-74):
  ```ts
  writeFileSync(join(pluginDir, 'data.json'),
    JSON.stringify({ idleTimeoutSeconds: opts.idleTimeoutSeconds }));
  ```
  To let e2e set the new setting, add `minFocusSecondsToRecord` to `LaunchOptions`
  and include it in this JSON object. Dev overrides file is written to
  `runDir/dev-config-overrides.json` and its path passed via
  `DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR` env (lines 89-94).
- Identity pinned via localStorage before `enablePlugin`. Harness exposes
  `openFile`, `openSettings`, `closeSettings`, `disablePlugin`, `close`, `page`,
  `vaultDir`.

### `e2e/harnessFixture.ts`
```ts
export const HIGH_IDLE_SECONDS = 180;
export function useHarness(
  idleTimeoutSeconds: number,
  devConfigOverrides?: DevConfigOverrides,
): () => ObsidianHarness
```
Registers `beforeEach` launch + `afterEach` close; returns a getter for the live
harness. If `LaunchOptions` gains `minFocusSecondsToRecord`, this signature and
`ObsidianHarness.launch({...})` call must thread it through (likely add a param
or make it an options object — currently positional).

### `e2e/vhAssert.ts` — assertion helpers
- `vhFilePath(vaultDir, docId)` -> full `.vh_v3` path.
- `readIfExists`, `sessionLines(file)`, `pollForSessionLine(file, {timeoutMs, intervalMs?})`
  -> `PollResult { content, lines, firstLine, elapsedMs }`, throws on timeout.
- `parseDurationMs(line)` -> integer ms from `<stamp> D:<millis>`.
- `sleep(ms)`.
For a "below threshold => NO line recorded" test you must assert ABSENCE within a
bounded window (e.g. `sessionLines(file)` stays empty / file absent after a wait),
since `pollForSessionLine` only proves presence. No negative-assert helper exists
yet — a small bounded wait + `expect(sessionLines(file)).toHaveLength(0)` is the
approach.

### Existing e2e spec files (all `e2e/*.e2e.ts`)
- `canvasFocus.e2e.ts`
- `closeUnloadFlush.e2e.ts`
- `focusSwitch.e2e.ts`
- `idleTimeout.e2e.ts`   (S5)
- `idleTimeoutOverride.e2e.ts`  (S6)
- `switchToSettings.e2e.ts`

### `e2e/idleTimeout.e2e.ts` (S5) — spec structure + the ~0ms callout
```ts
const IDLE_SECONDS = 5; // plugin-enforced floor
test.describe('S5 unfocus on idle', () => {
  const getHarness = useHarness(IDLE_SECONDS);
  test('idle closes the session at last activity, below the idle window', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);
    await h.openFile(FILE_A);
    const result = await pollForSessionLine(aFile, { timeoutMs: 12_000 });
    expect(result.lines).toHaveLength(1);
    const durationMs = parseDurationMs(result.firstLine);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(5_000);   // idle tail NOT counted
    expect(result.elapsedMs).toBeLessThan(9_000);  // idle path, not 10s grace
  });
});
```
The "S5/S6 ~0ms line" callout: because no input is sent, the recorded duration
ends at the LAST activity, so it is effectively ~0ms (`durationMs >= 0` and
`< 5000`). S6 (`idleTimeoutOverride.e2e.ts`) uses `useHarness(180, { idleTimeoutSeconds: 1 })`
to drive a SUB-FLOOR idle close in ~1s, asserting `elapsedMs < 4000`. This is the
template for a new min-focus e2e: for a min-focus test you would want a session
whose duration is deterministically tiny (~0ms) and assert it is NOT recorded
when the min is above 0.

### `e2e/constants.ts`
`PLUGIN_ID='visit-history'`, `DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR`, `VH_TOP_DIR`,
`USER_NAME='e2e_user'`, `DEVICE_NAME='e2e_device'`, LS keys, `DOC_ID_A/B/C`,
`FILE_A='A.md'`/`FILE_B`/`FILE_C='C.canvas'`, `SESSION_LINE_RE = /^\S+ D:\d+$/`.

---

## 10. docs — where to update

`docs/` files: `README.md`, `architecture.md`, `visit-history-format.md`,
`heatmap-view.md`, `how-to-publish.md`, `e2e-testing.md`, `migration/extraction-of-id.md`,
plus many `docs/tickets/*.md`.

The page documenting sessions-close semantics + the V3 on-disk format is
**`docs/visit-history-format.md`**. The "Duration file content
(`VhV3DurationStore`)" section lists the session-close triggers and includes:
- "A session closes on the first of: navigation away ... , blur ... , the idle
  timeout elapsing without user interaction (settings -> \"Idle timeout
  (seconds)\", default 180 s, min 5 s, applied live; ...) , or plugin unload ..."
- "Zero-duration sessions (pass-through navigation) are recorded truthfully as
  `D:0`."  <-- THIS statement changes: with a min-focus threshold > 0, sub-threshold
  (incl. zero-duration) sessions are DROPPED, not recorded. Update this line and
  add a sentence describing the new "minimum focus time before a visit is
  recorded" setting.

`docs/README.md` describes recording at a high level ("each completed focus
session ... is appended") — optionally mention the new gate. `docs/architecture.md`
may reference the sink/recorder chain (worth a grep for `FocusDurationSink` /
`VhV3DurationRecorder` there when implementing).

---

## Summary checklist of files to touch
1. `src/settings.ts` (+ `src/settings.test.ts`)
2. `src/core/config/ConfigProvider.ts` (+ `ConfigProvider.test.ts`); optionally
   `DevConfigOverridesReader.ts` (+ tests) + `e2e/constants.ts` if a dev override
   is added.
3. New `src/core/focusDuration/MinFocusDurationSink.ts` (+ `.test.ts`).
4. `src/core/init/PluginFactory.ts` (wrap the recorder; import decorator).
5. `src/settingsTab/VisitHistorySettingTab.ts` (declarative + imperative + copy
   consts; update the `setControlValue` comment).
6. `e2e/obsidianHarness.ts`, `e2e/harnessFixture.ts` (thread the new setting) +
   a new `e2e/*.e2e.ts` spec.
7. `docs/visit-history-format.md` (session-close / D:0 semantics).
