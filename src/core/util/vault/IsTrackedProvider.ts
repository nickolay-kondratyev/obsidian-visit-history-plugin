import { TFile, View } from "obsidian";
import { TRACKED_EXTENSIONS, TRACKED_VIEW_TYPES, VISIT_HISTORY_TOP_DIR } from "../../../Constants";

export interface IsTrackedProvider {
  isTrackedFile(file: TFile): boolean;

  isTrackedView(view: View | null): boolean;
}

export class IsTrackerProviderDefault implements IsTrackedProvider {
  isTrackedFile(file: TFile): boolean {
    const notVisitHistoryFile = !file.path.startsWith(VISIT_HISTORY_TOP_DIR);
    const hasTrackedExtension = TRACKED_EXTENSIONS.has(file.extension);

    return hasTrackedExtension && notVisitHistoryFile;
  }

  isTrackedView(view: View | null): boolean {
    if (view === null) {
      console.log("[VHP][isTrackedView] [view] is null skipping.");
      return false;
    }

    const file = (view as any).file ?? null;
    if (file === null) {
      console.log("[VHP][isTrackedView] [file] is null skipping.");
      return false;
    }

    if (file.path == null) {
      console.log("[VHP][isTrackedView] [path] is null skipping.");
      return false;
    }

    if (file.path.startsWith(VISIT_HISTORY_TOP_DIR)) {
      console.log("[VHP][isTrackedView] skipping visit history file: " + file.path);
      return false;
    }

    let ofRightType = TRACKED_VIEW_TYPES.has(view?.getViewType() ?? '');

    return ofRightType && (view as any).file !== null;
  }
}