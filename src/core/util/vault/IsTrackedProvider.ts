import { TFile, View } from "obsidian";
import { TRACKED_EXTENSIONS, TRACKED_VIEW_TYPES, VISIT_HISTORY_TOP_DIR } from "../../../Constants";

export interface IsTrackedProvider {
  isTrackedFile(file: TFile): boolean;

  isTrackedView(view: View | null): boolean;
}

export class IsTrackedProviderDefault implements IsTrackedProvider {
  isTrackedFile(file: TFile): boolean {
    const notVisitHistoryFile = !file.path.startsWith(VISIT_HISTORY_TOP_DIR);
    const hasTrackedExtension = TRACKED_EXTENSIONS.has(file.extension);

    return hasTrackedExtension && notVisitHistoryFile;
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

    return !file.path.startsWith(VISIT_HISTORY_TOP_DIR);
  }
}
