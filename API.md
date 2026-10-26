# Visit History — API for other plugins

Read visit stats and heatmap colors from your own Obsidian plugin.

- **Read-only**: nothing behind the API writes any file (not even doc ids).
- **Desktop and mobile.**
- **Paths are vault-relative** (e.g. `notes/a.md`), like `TFile.path`.

## 1. Get the API

The API is the `api` field of the Visit History plugin (id `visit-history`).
Plugins load in no fixed order, so handle both cases:

```ts
import { App, Events, Plugin } from 'obsidian';
import type { VisitHistoryApi } from './VisitHistoryApi'; // the block in section 2

/** `app.plugins` is not in Obsidian's public typings — the usual cross-plugin cast. */
function getVisitHistoryApi(app: App): VisitHistoryApi | undefined {
  const plugins = (app as App & { plugins: { getPlugin(id: string): { api?: VisitHistoryApi } | null } }).plugins;
  return plugins.getPlugin('visit-history')?.api;
}

export default class MyPlugin extends Plugin {
  private visitHistory: VisitHistoryApi | undefined;

  onload(): void {
    // Visit History loaded BEFORE us: pick it up once the layout is ready.
    this.app.workspace.onLayoutReady(() => {
      const api = getVisitHistoryApi(this.app);
      if (api) this.connect(api);
    });
    // Visit History loads AFTER us (or is re-enabled later): it announces itself.
    // (Custom event names are not in Obsidian's Workspace typings → upcast to Events.)
    this.registerEvent(
      (this.app.workspace as Events).on('visit-history:api-ready', (api) => this.connect(api as VisitHistoryApi)),
    );
  }

  private connect(api: VisitHistoryApi): void {
    if (this.visitHistory === api) return; // both paths fired for the same instance
    this.visitHistory = api;
    // Re-query what you show whenever colors/stats may have changed.
    // this.register(...) unsubscribes on YOUR plugin's unload.
    this.register(api.onChangeV1(() => this.refreshColors()));
    this.refreshColors();
  }

  private refreshColors(): void {
    void this.visitHistory?.getFileColorV1('notes/a.md').then((color) => {
      if (color) console.log(color.fill, color.hasData);
    });
  }
}
```

When Visit History is disabled, `getPlugin('visit-history')` returns `null`
(and its `api` is `undefined`) — treat the data as unavailable.

## 2. The interface

Copy this into your plugin (the source of truth is
[`src/api/VisitHistoryApi.ts`](src/api/VisitHistoryApi.ts)):

```ts
export interface VisitHistoryApi {
  /**
   * The file's color using the CURRENT heatmap color settings — exactly what the
   * heatmap draws for its tile (un-hovered). undefined = not a tracked file.
   */
  getFileColorV1(path: string): Promise<FileColorV1 | undefined>;

  /**
   * Visit stats across ALL users and devices, closed sessions only.
   * undefined = not a tracked file. Never visited → { lastVisitMs: null, totalFocusMs: 0 }.
   */
  getVisitStatsV1(path: string): Promise<VisitStatsV1 | undefined>;

  /**
   * Called (no arguments) when colors/stats may have changed. Returns unsubscribe —
   * call it on your plugin's unload.
   */
  onChangeV1(callback: () => void): () => void;
}

export interface FileColorV1 {
  /** '#rrggbb' */
  fill: string;
  /** false → fill is the "no data" color (e.g. never visited); the heatmap dims these. */
  hasData: boolean;
}

export interface VisitStatsV1 {
  /** Most recent session START (epoch ms), or null if never visited. */
  lastVisitMs: number | null;
  /** Sum of all closed session durations (ms); 0 if never visited. */
  totalFocusMs: number;
}
```

## 3. What the values mean

- **Tracked file** = a note (`.md`), canvas, or Excalidraw drawing that the
  heatmap shows. Anything else (missing file, other extension, the plugin's own
  legacy history folders) → `undefined`.
- **Colors mirror the heatmap settings** the user picked: color mode (by
  **type**, or by **time**), the time field (**visited** / **modified** /
  **created**), gradient, and hot/cold days. If the heatmap colors by modified
  time, so does the API. Settings are read on every call.
- **Visits count once the session closes** — the user navigates away, switches
  windows, opens Settings, or goes idle. An open session is not counted yet.
- **All users and devices** in the vault are included (per-device history only
  syncs if the vault's sync copies dot-folders).
- **`onChangeV1` fires** after the user changes heatmap color settings and after
  each saved visit session. It does NOT fire on file edits, renames, or deletes —
  listen to Obsidian's vault events for those. A throwing callback is logged and
  never affects other callbacks.

## 4. Versioning

Versioning is **per method**: every method and payload type ends in `V<n>`.

- A `V1` method's shape **never changes**.
- An incompatible change adds a new method (`getFileColorV2`) **alongside** the
  old one.
- There is no global API version. Feature-detect instead (declare newer
  methods as optional in your copy of the interface, e.g. `getFileColorV2?: …`):

```ts
if (typeof api.getFileColorV2 === 'function') {
  // newer Visit History
} else {
  // fall back to getFileColorV1
}
```
