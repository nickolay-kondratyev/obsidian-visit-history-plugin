import { TFile, View } from "obsidian";
import { TRACKED_EXTENSIONS, TRACKED_VIEW_TYPES, VISIT_HISTORY_TOP_DIR } from "../../../Constants";
import { VhUserPaths } from "../../service/visitHistoryService/user/VhUserPaths";

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
   * self-tracking loops, never shown in the heatmap). `__visit_history/` is
   * VISIBLE to the Vault API (not a dot-folder, so Obsidian Sync syncs it) —
   * this exclusion is the only gate keeping it out. Legacy `_visit_history/`
   * (V1) stays on disk untouched and stays excluded too.
   */
  private static isVisitHistoryPath(path: string): boolean {
    return (
      IsTrackedProviderDefault.isUnderDir(path, VhUserPaths.TOP_DIR) ||
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
