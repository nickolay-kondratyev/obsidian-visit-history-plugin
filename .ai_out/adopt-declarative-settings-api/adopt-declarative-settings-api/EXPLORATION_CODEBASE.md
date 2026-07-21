# EXPLORATION: Codebase context — adopt declarative settings API in VisitHistorySettingTab

## 0. CRITICAL — declarative API absent from installed typings
`node_modules/obsidian` = **1.12.3**. Grep of the whole obsidian tree for `getSettingDefinitions`/`SettingDefinition`/`declarative` → nothing. Only surface:
- `obsidian.d.ts:4996` — `abstract class PluginSettingTab extends SettingTab { constructor(app, plugin) }`
- `obsidian.d.ts:5707-5740` — `abstract class SettingTab` exposes only: `icon` (1.11), `app`, `containerEl`, `abstract display()`, `hide()`. No `getSettingDefinitions()`, no `SettingDefinition`.

Implication: adopting `getSettingDefinitions()` requires (a) bumping `obsidian` dev dep, (b) local `.d.ts` declaration merge/augmentation, or (c) cast. Resolve typing first. Runtime mock also lacks the API.

## 1. `src/settingsTab/VisitHistorySettingTab.ts` (95 lines)
Imports: `App, PluginSettingTab, Setting` from obsidian; `VisitHistoryPlugin` from `../main`; `DEFAULT_IDLE_TIMEOUT_SECONDS, MIN_IDLE_TIMEOUT_SECONDS` from `../settings`; `DocIdBackfillResult, DocIdBackfillService`; `UserNotifier`; `ConfirmModal`.

Constructor (13-20):
```ts
constructor(
  app: App,
  private readonly visitHistoryPlugin: VisitHistoryPlugin,
  private readonly docIdBackfillService: DocIdBackfillService,
  private readonly userNotifier: UserNotifier,
) { super(app, visitHistoryPlugin); }
```

`display()` (22-41): `containerEl.empty()` → `displayIdleTimeoutSetting()` → `.setHeading()` Setting `'File modifying actions'` → backfill Setting:
```ts
new Setting(this.containerEl)
  .setName('Add ids to all eligible files')  // "ids" not "id": sentence-case lint uppercases bare "id"→"ID"
  .setDesc('Assigns a persistent doc id to every markdown, canvas, and '
    + 'excalidraw.md file that does not already have one — the same id '
    + 'normally assigned when a file is opened.')
  .addButton(btn => btn.setButtonText('Add ids')
    .onClick(() => this.confirmAndRunDocIdBackfill()));
```

`displayIdleTimeoutSetting()` (43-64) — numeric setting, validation + live-apply:
```ts
new Setting(this.containerEl)
  .setName('Idle timeout (seconds)')
  .setDesc('Seconds without any interaction before the focused note is '
    + 'treated as idle: its visit-duration session is closed, ending at '
    + `the last interaction. Minimum ${MIN_IDLE_TIMEOUT_SECONDS}; `
    + `default ${DEFAULT_IDLE_TIMEOUT_SECONDS} (3 minutes). Applies immediately.`)
  .addText(text => text
    .setPlaceholder(String(DEFAULT_IDLE_TIMEOUT_SECONDS))
    .setValue(String(this.visitHistoryPlugin.settings.idleTimeoutSeconds))
    .onChange(async (value) => {
      const seconds = Number(value);
      if (!Number.isInteger(seconds) || seconds < MIN_IDLE_TIMEOUT_SECONDS) return; // silent reject, NO clamp
      this.visitHistoryPlugin.settings.idleTimeoutSeconds = seconds;
      await this.visitHistoryPlugin.saveSettings();
    }));
```
Behavior to preserve: **text field** (not slider); rejects non-integers and `< 5` silently (prior valid value stays, field keeps bad text until reopen); live-apply = mutate `settings.idleTimeoutSeconds` + `saveSettings()` (timer reads live getter — no notify needed).

Backfill wiring (66-94): `confirmAndRunDocIdBackfill()` opens `ConfirmModal` (title `"Add 'id' field to all eligible files"`, ctaLabel `'Add ids'`, onConfirm → `runDocIdBackfill()`). `runDocIdBackfill()` = notifier info → `docIdBackfillService.backfillAll()` → `notifyBackfillOutcome(result)` (error if `failedPaths.length>0`, else info `Done — N eligible files now have an id.`).

## 2. `src/settings.ts`
- `DEFAULT_IDLE_TIMEOUT_SECONDS = 180` (l8), `MIN_IDLE_TIMEOUT_SECONDS = 5` (l14).
- `interface VisitHistoryPluginSettings { idleTimeoutSeconds: number; heatmap: HeatmapConfig }` (19-22).
- `SettingsSanitizer.sanitize(loadedData: unknown)` (31-46): `sanitizeIdleTimeoutSeconds` valid = `number && Number.isInteger && >= MIN`, else default; `HeatmapConfigSanitizer.sanitize(raw.heatmap)`.
- Save/load in main.ts: `loadSettings()` (163-166) = `settings = SettingsSanitizer.sanitize(await loadData())`; `saveSettings()` (168-170) = `await saveData(settings)`.

## 3. ConfirmModal + DocIdBackfillService
`ConfirmModal extends Modal`; `ConfirmModalParams { title, body, ctaLabel, onConfirm }`; warning CTA button runs onConfirm only on explicit click. `src/settingsTab/ConfirmModal.ts:1-41`.
`DocIdBackfillService.backfillAll(): Promise<DocIdBackfillResult>` (concurrent calls JOIN). `DocIdBackfillResult { eligibleFileCount: number; failedPaths: string[] }`. Impl `DocIdBackfillServiceDefault`.

## 4. Wiring seam
main.ts:49-54:
```ts
this.addSettingTab(new VisitHistorySettingTab(
  this.app, this, factory.docIdBackfillService, this.userNotifier));
```
`PluginFactory` exposes `readonly userNotifier` (`UserNotifierDefault`) and `readonly docIdBackfillService` (`DocIdBackfillServiceDefault`). Idle-timeout consumed live at PluginFactory:133-136 via `() => this.plugin.settings.idleTimeoutSeconds * 1000` — only non-test consumer. Tab just mutates settings + saveSettings().

## 5. Tests / mock
- NO test file for `VisitHistorySettingTab` or `ConfirmModal`. `ModalUserNamePrompt` deliberately untested ("obsidian stand-in has no Modal").
- `src/testSupport/obsidianMock.ts` (aliased via `vitest.config.ts:9`) provides ONLY: `TAbstractFile, TFolder, TFile, normalizePath, Notice, Platform`. NO `PluginSettingTab, Setting, Modal, App, addText/addButton`. Any tab/declarative test needs these added to the mock first.
- Sanitizer tests in `src/settings.test.ts` (GIVEN/WHEN/THEN, `describe('SettingsSanitizer')`) — cover sanitizer only.

## 6. Sentence-case / copy conventions
- Names sentence case: `'Idle timeout (seconds)'`, `'File modifying actions'`, `'Add ids to all eligible files'`.
- Descriptions full sentences ending in periods; live settings end with `'Applies immediately.'`.
- Deliberate lowercase "ids" (not "ID") — lint rule uppercases bare "id". Quoted `'id' field` used where raw key meant.
- Real ellipsis char `…` in notices.

## Migration considerations
1. Blocker: typings lack API (§0) — resolve version/typing first.
2. Idle-timeout = validated text input, silent-reject (no clamp) — declarative "number" may clamp/coerce differently; preserve or intentionally change.
3. Live-apply = mutate `settings.idleTimeoutSeconds` + `saveSettings()`.
4. Backfill button = imperative ConfirmModal + `backfillAll()` + notifier — if declarative can't express confirm-modal button, keep hybrid tab.
5. No tab tests; mock needs `Setting`/`PluginSettingTab`/declarative stubs before coverage.
