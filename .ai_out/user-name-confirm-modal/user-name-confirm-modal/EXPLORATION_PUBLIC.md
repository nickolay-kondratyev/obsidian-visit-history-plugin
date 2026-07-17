# EXPLORATION — user-name confirmation modal (branch `user-name-confirm-modal`)

Explores replacing the SILENT user-name auto-resolution with a **confirmation modal** shown on any device with no pinned name yet, and deferring all VH recording / name-dependent tasks until a name is pinned.

## Key facts

- The user name is resolved exactly **once** in `src/main.ts:39` (`UserNameProviderDefault.getUserName()`), cached in device-scoped `localStorage`, then threaded as a plain `string` into three places: `VhUserScopeMigrationService` (`main.ts:42`), `PluginFactory` (`main.ts:49`), and — inside the factory — `VhV3DurationStore` (`PluginFactory.ts:63`) and `VhV3ReadmeWriter` (`PluginFactory.ts:92`).
- Pinning today = `LocalStorageUserNameCache` on raw `localStorage` key **`obsidian-vh-user-name`** (`UserNameProvider.ts:42`). Raw (not `App#loadLocalStorage`) precisely because it must be **device-scoped, not vault-scoped** — same rationale as `DeviceNameProviderDefault` (`DeviceNameProvider.ts:15`). This is exactly the "first pin wins forever, non-synced" mechanism the feature wants — reusable unchanged.
- "First resolution wins" is already implemented (`UserNameProvider.ts:80-88`): if the cache has a value it's returned without re-resolving. "Devices with an already-pinned name NEVER see the modal" maps directly onto this early-return.
- `Platform` IS exported by obsidian (`obsidian.d.ts:4677`) but is **currently unused anywhere in `src/`**. Desktop-vs-mobile is inferred INDIRECTLY today: `OsUserNameLookupDefault.getOsUserName()` returns `null` on mobile because `require('os')` throws (`UserNameProvider.ts:18-30`). Same trick in `DeviceNameProvider.ts:31-41`.
- Obsidian's `Modal` (`obsidian.d.ts:4332`) has `open()`, `close()`, `onOpen()`, `onClose()`, `setTitle`, `titleEl`/`contentEl`. No built-in "resolved" signal — a Promise wrapper must resolve from button `onClick` / `onClose`.

## 1. UserNameProvider — what changes vs stays

File: `src/core/service/visitHistoryService/user/UserNameProvider.ts`.

Current interfaces (all reusable):
- `UserNameProvider { getUserName(): Promise<string> }` — the seam main.ts calls.
- `OsUserNameLookup { getOsUserName(): string | null }` + `OsUserNameLookupDefault` (`require('os').userInfo().username`). **Reusable** as the desktop pre-fill source.
- `UserNameCache { get(): string|null; set(userName): void }` + `LocalStorageUserNameCache` (key `obsidian-vh-user-name`). **Reused unchanged** as the pin store.

Current resolution flow (`resolveUserName`, `UserNameProvider.ts:92-105`):
1. cached → return (first-wins).
2. desktop OS name (non-null) → return.
3. mobile: exactly one existing `__visit_history/user/<name>` dir → adopt it.
4. mobile fallback → `mobile-user-<random8>` (`crypto.randomUUID().slice(0,8)`).

**STAYS:** the `UserNameProvider` interface shape; the cache (interface, impl, key, first-wins early-return); `OsUserNameLookup` for desktop pre-fill; `HiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR)` enumeration.

**CHANGES:** steps 2-4 collapse into a single "no pin yet → ask the modal" path. Random-mint (step 4) and single-dir silent adoption (step 3) are DELETED. Desktop OS-name branch (step 2) becomes the **pre-fill value**, not an auto-answer. Crucially, `getUserName()` currently ALWAYS returns a string and always writes the cache. With a dismissable modal, resolution must be able to return **"no name chosen this session"** WITHOUT writing the cache — return type changes (e.g. `Promise<string | null>`), and `this.cache.set()` fires only on an explicit confirmed choice.

Test file `UserNameProvider.test.ts`: fakes `FixedOsUserNameLookup` and `InMemoryUserNameCache` (with `seed`) — reuse. The three mobile tests (single-dir adopt / multi-dir fallback / no-dir fallback, `UserNameProvider.test.ts:74-96`) encode DELETED behavior and must be rewritten to assert modal interaction. New `FakeUserNamePrompt` needed (§8).

## 2. Consumers of the user name / onload ordering (`src/main.ts`)

Onload order today (`main.ts:20-67`):
1. `loadSettings()`.
2. `VhTopDirRenameMigrationService.migrateIfLegacyPresent()` (`main.ts:29`) — **name-INDEPENDENT**, still runs first.
3. `getUserName()` (`main.ts:39`).
4. `VhUserScopeMigrationService(…, userName).migrateIfLegacyPresent()` (`main.ts:42`) — **NEEDS name**.
5. `new PluginFactory(this, userName)` (`main.ts:49`) → wires everything.
6. `initVaultTreeMapView`, `addSettingTab`, `onLayoutReady(() => factory.vhStartupTasks.run())` (`main.ts:53-66`).

Downstream of `userName`:

| Consumer | File:line | Needs name? | Notes |
|---|---|---|---|
| `VhUserScopeMigrationService` | `main.ts:42`, service `.ts:50` | **YES** — write target `userRootDir(userName)` | one-shot legacy move; safe to defer (§7) |
| `VhV3DurationStore` (write) `appendFocusDuration` | `PluginFactory.ts:63`, store `.ts:47` | **YES** — write path `focusDurationFilePath(this.userName,…)` | the recorder sink |
| `VhV3ReadmeWriter` (via `VhStartupTasks`) | `PluginFactory.ts:92`, writer `.ts:60` | **YES** — writes `readmePath(userName)` | already deferred to `onLayoutReady` |
| `VhV3DurationStore` aggregate READ `getLastFocusStartMsAcrossUsersAndDevices` | store `.ts:63-81` | **NO** — lists ALL users, never touches `this.userName` | heatmap read path name-independent |
| `DocIdFocusListener` / `docIdService` | `PluginFactory.ts:78` | **NO** — user-agnostic | |
| heatmap view / `VaultUtil` / `VisitHistoryServiceV3` | `PluginFactory.ts:83-90` | **NO** (reads aggregate) | holds the same `vhV3DurationStore` instance |

Effectively the WRITE path (`appendFocusDuration`) is the sole runtime dependency inside the factory, plus the README writer.

### Seam options for deferred recording (with recommendation)

Goal: plugin fully loads WITHOUT a name; heatmap (read-only, name-independent) works; only RECORDING + `VhUserScopeMigrationService` + README are deferred until the modal pins a name.

- **Option A — no-op/swappable sink until pinned.** Keep the full factory wired with a placeholder `FocusDurationSink` (`FocusDurationTracker.ts:1-4`, 1-method interface, injected via ctor `FocusDurationTracker.ts:100-104`); swap in the real `VhV3DurationRecorder` on pin. Pre-pin sessions silently dropped (matches accepted requirement). Store still needs a real `userName` before first write → sink swap must also construct/repoint `VhV3DurationStore`.
- **Option B — don't register the duration listener until pinned.** Skip `focusTracker.registerListener(new VhV3FocusDurationListener(...))` (`PluginFactory.ts:79-81`) until the name resolves. `FocusTracker.registerListener` (`FocusTracker.ts:77`) is public/additive → late registration is clean. `DocIdFocusListener` stays registered (name-independent). Tracker/`WindowActivityMonitor` (`PluginFactory.ts:65-73`) still need constructing — build eagerly with placeholder sink or defer that block too.
- **Option C — deferred/two-phase factory.** Largest change; `PluginFactory` ctor does everything in one pass (`PluginFactory.ts:45-93`), `onunload` reads `this.factory?.focusDurationTracker.dispose()` (`main.ts:122`). Over-engineering for this surface.

**Recommendation: Option B combined with a small refactor** so name-dependent components (`VhV3DurationStore`, `VhV3DurationRecorder`, `VhUserScopeMigrationService`, README task) are constructed/activated from a callback the modal resolution fires. Option A is the fallback if wiring should stay static. Note `onunload`'s `dispose()` must stay null-safe if the tracker is lazy.

## 3. Modal patterns in the codebase

- `src/settingsTab/ConfirmModal.ts` is the template: `extends Modal`, `onOpen()` sets `titleEl` + content, buttons via `new Setting(this.contentEl).addButton(...)`, `onClose()` empties content. **onConfirm runs only on CTA click; Cancel/Esc/click-outside do nothing** (`ConfirmModal.ts:22-40`) — exactly the "dismiss → no pin" shape.
- Usage example: `VisitHistorySettingTab.confirmAndRunDocIdBackfill()` (`SettingsTab.ts:66-77`).
- Text field via `Setting.addText` (`TextComponent`); existing names via `addButton`s or `addDropdown`.
- `UserNotifier` (`src/core/util/userComm/UserNotifier.ts`) is the DIP pattern to copy.

**Recommended DIP shape:** Obsidian-agnostic `UserNamePrompt { promptForUserName(input: { existingNames: string[]; defaultName: string | null }): Promise<string | null> }` (null = dismissed). Obsidian-side impl = `Modal` subclass resolving the Promise. Decision/persistence logic (validate, pin, first-wins) stays in a testable class depending only on `UserNamePrompt`, `UserNameCache`, `OsUserNameLookup`, `HiddenFileUtil`. `FakeUserNamePrompt` in tests.

## 4. Existing-name enumeration

`HiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR)` — used at `UserNameProvider.ts:98` and `VhV3DurationStore.ts:69`. `VhUserPaths.USERS_DIR = '__visit_history/user'` (`VhUserPaths.ts:26`). Returns basenames, `[]` when dir absent (`HiddenFileUtilDefault.ts:39-47`; fake mirrors, `FakeHiddenFileUtil.ts:61-73`). **Directly reusable** for the modal's existing-names list.

## 5. Name validation

`src/core/service/visitHistoryService/DocIdFilenameSafety.ts` — `isFilenameSafeId` with `FILENAME_SAFE_ID_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,198}[A-Za-z0-9_-]$|^[A-Za-z0-9_-]$/`. ONLY filename-safety logic in the repo. Rejects empty, `/`, `\`, `.`/`..`, leading/trailing dot, **spaces**, colon, newline, >200 chars.

User name is a path segment (`VhUserPaths.userRootDir`), so the charset problem is the same. BUT the class is doc-id-scoped by name. Options: (a) call directly (misleading coupling), (b) extract shared `FilenameSafety`, (c) sibling `UserNameSafety`. **Flag:** pattern **rejects spaces and non-ASCII**, yet OS login names / human names may contain them; today the OS name is pinned UNVALIDATED (`UserNameProvider.ts:93-95`). If the modal validates against this pattern, a pre-filled OS name with a space would be rejected — inconsistency to resolve (open question 1).

## 6. Platform detection & OS login name

- No `Platform` usage today; mobile detected implicitly by `require('os')` throwing. Routes: (a) `OsUserNameLookup.getOsUserName()` null ⇒ mobile (no new dependency, injectable/testable), or (b) `Platform.isDesktopApp` (cleaner intent; obsidianMock has no `Platform`). Route (a) more consistent with existing seams.
- OS login name = `require('os').userInfo().username` via `OsUserNameLookupDefault` → desktop pre-fill.

## 7. VhUserScopeMigrationService interplay

Moves legacy `__visit_history/v2|v3` → `user/<userName>/v2|v3` (`VhUserScopeMigrationService.ts:44-59`). One-shot, error-isolated, idempotent/retry-safe (`exists` checks on source+destination). Cannot run before a pin (needs the name). Deferring to the post-pin callback is SAFE: no name ⇒ no writes at all in the meantime; dismissed session ⇒ retries next launch (identical to its existing "retry on next load" contract).

## 8. Tests

- Reuse: `FixedOsUserNameLookup`, `InMemoryUserNameCache`, `FakeHiddenFileUtil`. Rewrite the three mobile-branch tests.
- `obsidianMock.ts` exports only `TAbstractFile`, `TFolder`, `TFile`, `normalizePath`, `Notice` — **no `Modal`/`Setting`/`Platform`/`TextComponent`**. The Obsidian-side modal class is NOT unit-testable through the mock as-is.
- **Recommendation:** keep the modal a thin Obsidian adapter (integration-only) behind `UserNamePrompt`; unit-test the pure resolver with `FakeUserNamePrompt` + existing fakes. Extend obsidianMock only if the modal itself must be unit-tested.

## 9. Edge cases

- **Multiple existing user dirs on desktop:** list them all (pick existing OR new), pre-filled with OS name. Enumeration handles N dirs.
- **Mobile, zero existing dirs:** free-text only (no pre-fill). No more random mint.
- **Typed name == existing dir:** legitimate (joining an identity) — allow, not an error.
- **Whitespace/empty input:** must reject/trim before pinning; disable confirm or show error for invalid input.
- **Workspace still loading:** README task already defers to `onLayoutReady` (`main.ts:64`); existing pattern favors `onLayoutReady` for UI/IO (open question 2).

## Open questions / ambiguities for CLARIFICATION

1. **Filename-safety vs human names.** Pattern rejects spaces/non-ASCII; OS pre-fill or typed names may contain them. (a) reject and force sanitization; (b) auto-sanitize pre-fill; (c) relax charset. Today the OS name is pinned unvalidated. Owner decision — changes which names are pinnable.
2. **When to open the modal:** during `onload` vs `onLayoutReady`.
3. **Return-type change of `getUserName()`:** nullable return vs new method. Affects `main.ts`/`PluginFactory.ts:45` signatures.
4. **Already-pinned devices (incl. existing `mobile-user-*` pins)** never see the modal (first-wins). Confirm desired.

## Suggested change surface

- `UserNameProvider.ts` — remove silent desktop/mobile/random resolution; conditional pinning on explicit choice; nullable return; add `UserNamePrompt` dependency. Keep `OsUserNameLookup`, `UserNameCache`, key `obsidian-vh-user-name`.
- **New:** `UserNamePrompt` interface + Obsidian `Modal` impl (mirror `ConfirmModal.ts`) + `FakeUserNamePrompt` in `src/testSupport/`.
- `src/main.ts` — modal-driven resolution; gate `VhUserScopeMigrationService`, recording wiring, `vhStartupTasks` behind resolved-name callback; load succeeds with no name.
- `src/core/init/PluginFactory.ts` — split name-dependent wiring (store/recorder/README + duration-listener registration) from name-independent (heatmap read, doc-id).
- Filename-safety extraction/reuse per open question 1.
- Tests: rewrite `UserNameProvider.test.ts` mobile cases; add prompt/resolver tests.
