import { TFile, View } from "obsidian";
import { LEGACY_VISIBLE_VISIT_HISTORY_TOP_DIR, TRACKED_EXTENSIONS, TRACKED_VIEW_TYPES, VISIT_HISTORY_TOP_DIR } from "../../../Constants";

export interface IsTrackedProvider {
  isTrackedFile(file: TFile): boolean;

  isTrackedView(view: View | null): boolean;
}

export class IsTrackedProviderDefault implements IsTrackedProvider {
  isTrackedFile(file: TFile): boolean {
    const hasTrackedExtension = TRACKED_EXTENSIONS.has(file.extension);

    return hasTrackedExtension && !IsTrackedProviderDefault.isVisitHistoryPath(file.path);
  }

  isTrackedView(view: View | null): boolean {
    if (view === null) {
      return false;
    }

    if (!TRACKED_VIEW_TYPES.has(view.getViewType())) {
      return false;
    }

    // System boundary: Obsidian's View type does not declare `file`, but the
    // tracked view types (markdown/canvas/excalidraw) carry it at runtime.
    const file = (view as View & { file?: TFile | null }).file ?? null;
    if (file === null || file.path == null) {
      return false;
    }

    return !IsTrackedProviderDefault.isVisitHistoryPath(file.path);
  }

  /**
   * The plugin's own visit-history files must never be tracked (no
   * self-tracking loops, never shown in the heatmap). The ACTIVE top dir
   * (`.plugin_data/visit_history/`, VhUserPaths.TOP_DIR) is dot-hidden, so the
   * Vault API never surfaces it and no gate is needed for it. What this gate
   * DOES exclude are the still-VISIBLE legacy leftovers a migration may not
   * have fully removed: `__visit_history/` (interim visible layout — e.g.
   * unmigrated v2 or skipped conflicts) and `_visit_history/` (V1). Both stay
   * on disk untouched and stay excluded.
   */
  private static isVisitHistoryPath(path: string): boolean {
    return (
      IsTrackedProviderDefault.isUnderDir(path, LEGACY_VISIBLE_VISIT_HISTORY_TOP_DIR) ||
      IsTrackedProviderDefault.isUnderDir(path, VISIT_HISTORY_TOP_DIR)
    );
  }

  /**
   * Boundary-aware containment check: a bare prefix test would also exclude
   * sibling paths that merely share the prefix (e.g. `__visit_history_notes/x.md`).
   */
  private static isUnderDir(path: string, dir: string): boolean {
    return path === dir || path.startsWith(dir + "/");
  }
}
