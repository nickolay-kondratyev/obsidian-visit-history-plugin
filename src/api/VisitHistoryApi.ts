// ── Public cross-plugin API (THE contract — see API.md at the repo root) ─────
//
// Other plugins reach it via `app.plugins.getPlugin('visit-history')?.api`,
// or receive it with the workspace event VISIT_HISTORY_API_READY_EVENT when
// they load first.
//
// Versioning is PER METHOD: every method and payload type carries a `V<n>`
// suffix. A V1 method's shape NEVER changes; an incompatible change adds a
// `...V2` alongside it. Consumers feature-detect
// (`typeof api.getFileColorV2 === 'function'`). There is no `apiVersion`.
//
// Payloads are plain object literals — never internal class instances — so
// internal refactors can't leak into consumers.

/** Workspace event triggered (with the {@link VisitHistoryApi} as its argument) once the API is set. */
export const VISIT_HISTORY_API_READY_EVENT = 'visit-history:api-ready';

/**
 * Read-only access to visit history and heatmap colors. Nothing behind it
 * writes any file. `path` is always a vault-relative path (e.g. `notes/a.md`).
 * Works on desktop and mobile, with or without a pinned user name.
 */
export interface VisitHistoryApi {
  /**
   * The file's color using the CURRENT heatmap color settings (color mode,
   * timestamp field, gradient, hot/cold days) — exactly what the heatmap
   * draws for the file's tile (un-hovered). Settings are read at call time.
   * @returns undefined when `path` is not a tracked file (missing, untracked
   *          extension, legacy visit-history dir, …).
   */
  getFileColorV1(path: string): Promise<FileColorV1 | undefined>;

  /**
   * Visit stats across ALL users and devices, CLOSED sessions only — a visit
   * shows up once its focus session closes (navigation away, blur, idle).
   * @returns undefined when `path` is not a tracked file; a never-visited
   *          tracked file → `{ lastVisitMs: null, totalFocusMs: 0 }`.
   */
  getVisitStatsV1(path: string): Promise<VisitStatsV1 | undefined>;

  /**
   * Subscribes to "colors/stats may have changed": the heatmap settings were
   * saved (ANY heatmap setting — extra calls with unchanged colors are
   * expected), or a visit session was persisted. The callback gets no
   * arguments — re-query what you show. File edits/renames/deletes are NOT
   * signalled here (listen to Obsidian's vault events for those).
   * A throwing callback is logged and never affects other callbacks.
   * @returns unsubscribe — call it on your plugin's unload.
   */
  onChangeV1(callback: () => void): () => void;
}

export interface FileColorV1 {
  /** `#rrggbb`. */
  fill: string;
  /**
   * false → `fill` is the gradient's "no data" (nil) color: heatmap color mode
   * and the file has no timestamp for the active field (e.g. never visited).
   * The heatmap draws these dimmed. Always true in type color mode.
   */
  hasData: boolean;
}

export interface VisitStatsV1 {
  /** Most recent session START (epoch ms), or null if never visited. */
  lastVisitMs: number | null;
  /** Sum of all closed session durations (ms); 0 if never visited. */
  totalFocusMs: number;
}
