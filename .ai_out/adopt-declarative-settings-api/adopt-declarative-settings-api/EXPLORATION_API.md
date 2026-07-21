# Obsidian Declarative Settings API (`getSettingDefinitions`) — Research

Research target: the declarative settings API introduced in Obsidian **1.13.0**
(`PluginSettingTab.getSettingDefinitions()`) that makes settings appear in
Obsidian's built-in **settings search**, and how to adopt it for this plugin's
`VisitHistorySettingTab` (notably the numeric "Idle timeout (seconds)" setting:
default 180, min 5).

All type quotes below are **verbatim from the shipped npm types** `obsidian@1.13.1`
(`obsidian.d.ts`, downloaded from the jsDelivr CDN mirror of the npm package).
That is the authoritative source — the master branch of `obsidianmd/obsidian-api`
on GitHub and the rendered docs site did NOT surface these types via the fetch
summarizer, but the published npm package definitively contains them.

---

## Summary (key findings)

- **CONFIRMED**: `getSettingDefinitions()` exists on `SettingTab` (and thus
  `PluginSettingTab`) since 1.13.0. Signature: `getSettingDefinitions(): SettingDefinitionItem[]`
  — **synchronous**, returns an array. Plural, exactly `getSettingDefinitions`.
- **CONFIRMED**: It is NOT search-only. When it returns a **non-empty** array the
  tab is **rendered declaratively from those definitions**, and `display()` is
  **NOT called**. `display()` is `@deprecated Since 1.13.0`. So adding
  `getSettingDefinitions()` does **not** duplicate/regress the imperative UI — it
  *replaces* it (on 1.13+). Both render + search indexing come from the one method.
- **CONFIRMED**: Value persistence is **centralized on the tab**, not per-control.
  Each control carries a `key` (+ optional `defaultValue`, `validate`); the tab's
  `getControlValue(key)` / `setControlValue(key, value)` read/write the value.
  `PluginSettingTab` overrides both to read/write `this.plugin.settings`. There is
  **no `onChange` callback on the control** in the declarative model.
- **CONFIRMED**: A numeric setting is `SettingNumberControl` (`type: 'number'`,
  with `min`, `max`, `step`, `placeholder`, plus base `key`/`defaultValue`/`validate`).
  A `slider` variant also exists (`SettingSliderControl`, requires `min`/`max`/`step`).
- **CONFIRMED**: The types ship in **obsidian npm 1.13.x** (latest is **1.13.1**,
  which is what these quotes are from). The project's installed types are **1.12.3**
  (verified: no `getSettingDefinitions`), so **bumping the dev dependency is the
  clean path** — no local type augmentation needed.
- **GOTCHA**: There is **no button control** in the declarative control union. The
  "Add ids" backfill button (which opens a `ConfirmModal`) must use either
  `SettingDefinitionAction` (whole-row click) or the `SettingDefinitionRender`
  imperative escape hatch (`render(setting, group)` → `setting.addButton(...)`).
- **DECISION (runtime compat)**: The plugin's `manifest.json` `minAppVersion` is
  **1.5.7**. `getSettingDefinitions` only works at runtime on 1.13+. Either bump
  `minAppVersion` to `1.13.0` and drop `display()`, or keep `display()` as a
  fallback for < 1.13 (duplicated UI logic; flagged by the official eslint rule).

---

## Research questions

1. Exact `getSettingDefinitions()` signature + return type; the `SettingDefinition`
   union and each definition's fields.
2. What definition/control "types" exist; what a numeric setting looks like.
3. Relation to imperative `display()` — keep both? render or just index? regression?
4. Do the npm types 1.13.x include these (bump vs augment)? Which version first shipped?
5. Minimal correct numeric example incl. persistence/onChange semantics.
6. Gotchas: plural? sync/async? anything else required?

---

## Findings

### 1. The method signatures (verbatim, `obsidian@1.13.1`)

On `SettingTab` (base of `PluginSettingTab`):

```ts
/**
 * Nested setting definitions as returned by getSettingDefinitions().
 * Populated by update().
 * @since 1.13.0
 */
settingItems: SettingDefinitionItem[];

/**
 * Override to provide setting definitions. Return an array of definitions
 * and inline groups. Called on every display() and once when the tab is
 * added to the setting modal for search indexing.
 * @since 1.13.0
 */
getSettingDefinitions(): SettingDefinitionItem[];

/**
 * Stores the result of getSettingDefinitions() for rendering and search indexing.
 * Called by addSettingTab() and by dynamic tabs when their data changes.
 * @since 1.13.0
 */
update(): void;

/** Read the current value for a control key. Called on every render of a
 *  `control`-type setting definition. ... PluginSettingTab ... override this to
 *  read from their conventional settings storage ... @since 1.13.0 */
getControlValue(key: string): unknown;

/** Persist a new value for a control key. Called on user change of a
 *  `control`-type setting definition. ... Override to persist elsewhere;
 *  pair with getControlValue. @since 1.13.0 */
setControlValue(key: string, value: unknown): void | Promise<void>;

/** Re-evaluate every `visible` and `disabled` predicate ... @since 1.13.0 */
refreshDomState(): void;

/**
 * Override to render the tab imperatively.
 * Not called when {@link getSettingDefinitions} returns a non-empty array;
 * the tab is rendered declaratively from those definitions instead. Only
 * implement display() as a fallback for plugins that need to support
 * Obsidian versions older than 1.13.0.
 * @deprecated Since 1.13.0. Use {@link getSettingDefinitions} instead.
 */
display(): void;
```

`PluginSettingTab` additionally documents its overrides:

```ts
export abstract class PluginSettingTab extends SettingTab {
    constructor(app: App, plugin: Plugin);
    /** @since 1.13.0 */
    getSettingDefinitions(): SettingDefinitionItem[];
    /** Reads from `this.plugin.settings`. Override to read from a different
     *  data source. @since 1.13.0 */
    getControlValue(key: string): unknown;
    /** Mutates and persists `this.plugin.settings`. Override to write to a
     *  different data source. @since 1.13.0 */
    setControlValue(key: string, value: unknown): void | Promise<void>;
}
```

**`getSettingDefinitions()` is synchronous** (returns `SettingDefinitionItem[]`,
not a Promise). Called once on tab-add for search indexing, and again on every
`display()`/`update()` for rendering.

### 2. The definition type hierarchy

Top-level return element type:

```ts
export type SettingDefinitionItem<K extends string = string> =
    SettingDefinition<K> | SettingDefinitionGroup<K> | SettingDefinitionList<K> | SettingDefinitionPage<K>;

export type SettingDefinition<K extends string = string> =
    SettingDefinitionControl<K> | SettingDefinitionRender | SettingDefinitionAction | SettingDefinitionEmpty;
```

So each array element is one of: a **control** setting, a **render** (imperative
escape hatch), an **action** (clickable row), an **empty** spacer, a **group**
(heading + items), a **list** (mutable collection w/ add/reorder/delete), or a
**page** (navigable sub-page).

Shared base for the setting rows:

```ts
export interface SettingDefinitionBase {
    name: string;                                   // display name + search
    desc?: string | DocumentFragment;               // description (textContent used for search)
    aliases?: string[];                             // extra search terms
    searchable?: boolean | (() => boolean);         // default true
    visible?: boolean | (() => boolean);            // default true; re-eval via update()
}

export interface SettingDefinitionControl<K extends string = string> extends SettingDefinitionBase {
    control: SettingControl<K>;
    action?: never;
    render?: never;
}

export interface SettingDefinitionAction extends SettingDefinitionBase {
    action: (el: HTMLElement, index: number) => void;   // whole-row click
    disabled?: boolean | (() => boolean);
    control?: never; render?: never;
}

export interface SettingDefinitionRender extends SettingDefinitionBase {
    control?: never; action?: never;
    render: (setting: Setting, group: SettingGroup) => void | (() => void); // imperative; may return cleanup
}

export interface SettingDefinitionEmpty extends SettingDefinitionBase { control?: never; action?: never; render?: never; }
```

Groups / pages (for structure — headings etc.):

```ts
export interface SettingDefinitionGroup<K extends string = string> {
    type: 'group' | 'list';
    heading?: string;                               // heading text above the group
    cls?: string;
    search?: { placeholder?: string; match: (def, query) => boolean };  // @since 1.13.1
    extraButtons?: ((component: ExtraButtonComponent) => any)[];
    items?: SettingGroupItem<K>[];
    visible?: boolean | (() => boolean);
}
export type SettingGroupItem<K extends string = string> = SettingDefinition<K> | SettingDefinitionPage<K>;
// SettingDefinitionList extends Group (type:'list', emptyState, onReorder, onDelete, addItem)
// SettingDefinitionPage (type:'page', name, desc, items? | page?(): SettingPage, displayValue?, status?)
```

### 3. The control union (what "types" exist)

```ts
export type SettingControl<K extends string = string> =
    SettingToggleControl<K> | SettingDropdownControl<K> | SettingTextControl<K>
  | SettingTextAreaControl<K> | SettingNumberControl<K> | SettingFileControl<K>
  | SettingFolderControl<K> | SettingSliderControl<K> | SettingColorControl<K>;
```

Nine control types: **toggle, dropdown, text, textarea, number, file, folder,
slider, color**. Note: **no `button`/`action` control** — button-like affordances
are `SettingDefinitionAction` (row click) or an imperative `render`.

Shared control base — this is where persistence is wired:

```ts
export interface SettingControlBase<V, K extends string = string> {
    key: K;                    // storage property name → getControlValue/setControlValue
    defaultValue?: V;          // fallback when the resolver returns undefined/null
    validate?: (value: V) => string | void | Promise<string | void>;
                               // return non-empty string → reject + show inline error (does NOT modify stored value)
    disabled?: boolean | (() => boolean);   // re-eval on each render
}
```

The numeric control (for the idle-timeout setting):

```ts
export interface SettingNumberControl<K extends string = string> extends SettingControlBase<number, K> {
    type: 'number';
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number | 'any';
}
```

Slider alternative (note `min`/`max`/`step` are **required** here, unlike number):

```ts
export interface SettingSliderControl<K extends string = string> extends SettingControlBase<number, K> {
    type: 'slider';
    min: number;
    max: number;
    step: number;
    displayFormat?: (value: number) => string;   // @since 1.13.1
}

export interface SettingTextControl<K> extends SettingControlBase<string, K> { type: 'text'; placeholder?: string; }
export interface SettingToggleControl<K> extends SettingControlBase<boolean, K> { type: 'toggle'; }
export interface SettingDropdownControl<K> extends SettingControlBase<string, K> { type: 'dropdown'; options: Record<string,string>; }
```

### 4. Relation to `display()` — no duplication, it REPLACES

From the `display()` doc comment above: *"Not called when `getSettingDefinitions`
returns a non-empty array; the tab is rendered declaratively from those definitions
instead."* And it is `@deprecated Since 1.13.0`.

Consequences:
- On **1.13+**: if `getSettingDefinitions()` returns a non-empty array, the app
  renders from it AND indexes it for settings search. `display()` never runs. So
  keeping a leftover `display()` does **not** double-render — it is dead on 1.13+.
- On **< 1.13**: the base class has no `getSettingDefinitions` call path, so
  `display()` is still the only thing that runs. This is why the base comment calls
  `display()` "a fallback for plugins that need to support Obsidian versions older
  than 1.13.0."

The official `obsidianmd/eslint-plugin` encodes exactly this migration
(rule descriptions, quoted from the repo):

- `settings-tab/prefer-setting-definitions` — *"Encourage PluginSettingTab
  subclasses to implement getSettingDefinitions() so settings appear in Obsidian
  1.13+ settings search."*
- `settings-tab/no-deprecated-display` — *"Disallow a leftover display() method on
  PluginSettingTab subclasses once getSettingDefinitions() is implemented and
  minAppVersion is 1.13.0 or later."*
- `settings-tab/require-display` — *"Require a display() method on PluginSettingTab
  subclasses when minAppVersion is below 1.13.0."*
- `settings-tab/prefer-update-over-display` — *"Prefer this.update() over
  this.display() to refresh a PluginSettingTab on Obsidian 1.13+."*

So the rules say: keep `display()` **only** while `minAppVersion < 1.13.0`; once
you bump `minAppVersion` to `1.13.0`, remove `display()` and refresh via `update()`.

### 5. Which npm types ship this + installed-version gap

- Latest `obsidian` npm is **1.13.1** (published ~mid-July 2026). It **contains**
  all of the above types (this document quotes it). 1.13.0 first shipped the API
  (`@since 1.13.0`); 1.13.1 added a few refinements (`group.search`,
  `slider.displayFormat`, `page.displayValue`/`status` — all `@since 1.13.1`).
- This project's **installed** types are **1.12.3** (verified:
  `grep -c getSettingDefinitions node_modules/obsidian/obsidian.d.ts` → `0`).
  `package.json` devDependency is `"obsidian": "latest"`, but the lockfile/installed
  tree is pinned at 1.12.3 — a reinstall/bump is required to get the 1.13.x types.
- **Recommendation: bump the dev dependency** (e.g. `obsidian@^1.13.1`, or pin
  `1.13.1`) and reinstall. The types are first-party and stable; **local type
  augmentation is unnecessary and fragile** (you'd have to hand-copy ~10 interfaces
  and keep them in sync). Bumping the *types* does **not** by itself require bumping
  `minAppVersion` — but *runtime* use does (see Decisions).

### 6. Minimal correct example (numeric setting, default 180, min 5)

Declarative equivalent of the current `Idle timeout (seconds)` text field. Note
the `key` (`'idleTimeoutSeconds'`) must be a real property of `plugin.settings`.

```ts
import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import VisitHistoryPlugin from '../main';
import { DEFAULT_IDLE_TIMEOUT_SECONDS, MIN_IDLE_TIMEOUT_SECONDS } from '../settings';

export class VisitHistorySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: VisitHistoryPlugin /* + deps */) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'Idle timeout (seconds)',
        desc: `Seconds without any interaction before the focused note is treated `
            + `as idle... Minimum ${MIN_IDLE_TIMEOUT_SECONDS}; default `
            + `${DEFAULT_IDLE_TIMEOUT_SECONDS} (3 minutes). Applies immediately.`,
        control: {
          type: 'number',
          key: 'idleTimeoutSeconds',            // property on plugin.settings
          defaultValue: DEFAULT_IDLE_TIMEOUT_SECONDS,
          min: MIN_IDLE_TIMEOUT_SECONDS,
          step: 1,
          placeholder: String(DEFAULT_IDLE_TIMEOUT_SECONDS),
          validate: (v) =>
            Number.isInteger(v) && v >= MIN_IDLE_TIMEOUT_SECONDS
              ? undefined
              : `Enter a whole number ≥ ${MIN_IDLE_TIMEOUT_SECONDS}.`,
        },
      },
      {
        type: 'group',
        heading: 'File modifying actions',
        items: [
          {
            name: 'Add ids to all eligible files',
            desc: 'Assigns a persistent doc id to every eligible file...',
            // No button control exists — use the imperative render escape hatch:
            render: (setting) => {
              setting.addButton((btn) =>
                btn.setButtonText('Add ids').onClick(() => this.confirmAndRunDocIdBackfill()));
            },
          },
        ],
      },
    ];
  }

  // Persistence: PluginSettingTab's defaults read/write plugin.settings and persist.
  // Override ONLY if you must route through the plugin's own saveSettings() (e.g. to
  // reuse existing side effects / debouncing). For idleTimeoutSeconds this is optional
  // because the value is live-read from settings by FocusDurationTracker.
  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings as Record<string, unknown>)[key] = value;
    await this.plugin.saveSettings();
  }
}
```

**How onChange / persistence works** in the declarative model: there is **no
per-control `onChange`**. When the user edits a control, Obsidian calls the tab's
`setControlValue(key, value)` (async allowed); when rendering, it calls
`getControlValue(key)`. `PluginSettingTab`'s defaults read from and "mutate and
persist" `this.plugin.settings`, so for a plain `data.json`-backed setting you can
implement just `getSettingDefinitions()` and rely on the defaults. Override
`setControlValue`/`getControlValue` only for custom storage or to reuse the plugin's
existing `saveSettings()` path. Live-apply happens because the value is written into
`plugin.settings`, which `FocusDurationTracker` already reads live.

Because the min is also expressed via `control.min` and `validate`, invalid input is
rejected with an inline error and not persisted — matching the current text field's
"invalid input is simply not persisted" behavior, but with clearer UX.

---

## Approaches comparison

| Approach | Description | Pros | Cons | Complexity | Best For |
|----------|-------------|------|------|------------|----------|
| **A. Bump `obsidian` types + `minAppVersion` 1.13.0; drop `display()`** | Reinstall `obsidian@^1.13.1`; implement `getSettingDefinitions()`; delete `display()`; bump manifest `minAppVersion` to `1.13.0` | Single source of truth; passes eslint `no-deprecated-display`; settings become searchable; least code long-term (DRY) | Drops support for Obsidian < 1.13.0 users; needs manifest + `versions.json` bump | Low–Medium | Plugins ready to require 1.13+ (recommended if owner accepts the floor) |
| **B. Bump types only; keep BOTH `getSettingDefinitions()` and `display()`** | Add declarative defs but retain `display()` as < 1.13 fallback; keep `minAppVersion` 1.5.7 | Backward compatible; searchable on 1.13+; no user cut-off | Two parallel UI definitions to maintain (DRY violation); eslint `no-deprecated-display` won't fire (minAppVersion < 1.13) but the duplication is real | Medium | Plugins that must keep a low `minAppVersion` for now |
| **C. Local type augmentation, no dep bump** | Hand-declare `getSettingDefinitions`/`SettingDefinition*` via `declare module 'obsidian'` | No dependency change | Must hand-copy ~10 interfaces; drifts from upstream; error-prone; still doesn't run on < 1.13 | Medium–High | Only if the dep genuinely cannot be bumped (not the case here) |

---

## Decisions for a human engineer

1. **Runtime floor**: bump `manifest.json` `minAppVersion` to `1.13.0` (enables
   Approach A: drop `display()`, cleanest) **or** keep the current `1.5.7` floor and
   maintain a `display()` fallback (Approach B). Recommendation: **A** if the owner
   is comfortable requiring Obsidian 1.13+, since it is DRY and the whole point
   (searchable settings) only benefits 1.13+ users anyway. Also update
   `versions.json`.
2. **Dependency bump**: change devDependency to a concrete `obsidian@^1.13.1` (the
   installed tree is pinned at 1.12.3 despite `"latest"`) and reinstall so the types
   resolve. Recommended over local augmentation (Approach C).
3. **Backfill button mapping**: the "Add ids" action has no declarative control.
   Use `SettingDefinitionRender` (`render(setting) => setting.addButton(...)`) to
   preserve the exact button text + `ConfirmModal` flow, or `SettingDefinitionAction`
   for a whole-row click. Recommendation: **`render`** (keeps the explicit button
   label and confirm modal; least behavior change).
4. **Persistence override**: decide whether to rely on `PluginSettingTab`'s default
   `setControlValue` (mutates + persists `plugin.settings`) or override it to route
   through the existing `plugin.saveSettings()`. For `idleTimeoutSeconds` the default
   is likely sufficient (value is live-read), but overriding keeps a single save path.

## Open questions

- **Exact default persistence behavior of `PluginSettingTab.setControlValue`**: the
  type doc says it "mutates and persists `this.plugin.settings`," but whether it
  calls `plugin.saveData` directly (vs any `saveSettings` hook) is not specified in
  the `.d.ts`. Verify empirically (or just override `setControlValue`) before relying
  on it. Not resolvable from types alone.
- **Search-index timing with `visible`/`disabled` predicates**: definitions hidden
  by `visible: () => false` are excluded from search "for that render cycle" — confirm
  this matches desired UX if any setting is conditionally hidden (none currently are).
- **`validate` + `min` interaction**: both can reject numeric input; confirm the app
  doesn't double-report (min-clamp vs validate message) in practice.
- A dedicated official **migration guide** page was referenced in the 1.13.0 release
  notes but could not be fetched cleanly during research (the rendered docs site and
  the changelog permalink 404'd via the fetch tool). The `.d.ts` doc comments + the
  eslint rules are the most authoritative accessible sources and are internally
  consistent.

## Sources

- **`obsidian@1.13.1` npm type definitions (authoritative)** — quoted verbatim above;
  fetched from `https://cdn.jsdelivr.net/npm/obsidian@1.13.1/obsidian.d.ts`
  (jsDelivr mirror of the npm package). Saved locally at
  `.tmp/obsidian-1.13.1.d.ts` in this repo during research.
- obsidian npm package (version list; latest 1.13.1): https://www.npmjs.com/package/obsidian
- Official eslint plugin (settings-tab migration rules): https://github.com/obsidianmd/eslint-plugin
- Obsidian developer docs — Settings: https://docs.obsidian.md/Plugins/User+interface/Settings
- Obsidian developer docs — PluginSettingTab: https://docs.obsidian.md/Reference/TypeScript+API/PluginSettingTab
- obsidian-api repo (obsidian.d.ts on GitHub): https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
- Obsidian changelog index: https://obsidian.md/changelog/
- 1.13.0 overview (third-party, corroborating the declarative API): https://roanbrasil.substack.com/p/obsidian-1130-whats-new-and-what

## Confirmed-vs-inferred

- **Confirmed from the shipped 1.13.1 `.d.ts`**: every type signature, field, and
  doc-comment quote in sections 1–3 and 5; the `display()` "not called when
  getSettingDefinitions returns non-empty" + `@deprecated` behavior; sync return;
  centralized `get/setControlValue` persistence; no button control.
- **Confirmed from the official eslint plugin**: the `minAppVersion 1.13.0` migration
  policy (keep `display()` below 1.13, drop it at/above 1.13; prefer `update()`).
- **Confirmed from npm + local check**: latest is 1.13.1; project installed types are
  1.12.3 and lack the API.
- **Inference (flagged)**: the recommendation to bump the dep over local augmentation;
  the choice of `render` for the backfill button; that the default `setControlValue`
  persistence suffices for `idleTimeoutSeconds` (should be verified at runtime).
