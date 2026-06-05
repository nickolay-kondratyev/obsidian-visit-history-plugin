import { App, TFile } from 'obsidian';
import { TRACKED_EXTENSIONS } from "../../../Constants";
import { FileTimeMetadata } from "../../data/FileTimeMetadata";
import { VisitHistoryService } from "../../service/visitHistoryService/VisitHistoryService";

export interface VaultUtil {
  getTrackedFiles(): Promise<TrackedFile[]>;
}

/** File in vault that is part of
 *  {@link TRACKED_EXTENSIONS} and is outside of _visit_history directory
 *  ({@link VISIT_HISTORY_TOP_DIR})
 *  */
interface TrackedFile {
  file: TFile;
  timeMetadata: FileTimeMetadata,
}

export class VaultUtilDefault implements VaultUtil {
  constructor(
    private readonly app: App,
    private readonly visitHistoryService: VisitHistoryService,
  ) {
  }

  getRawTrackedFiles(): TFile[] {
    return this.app.vault.getFiles().filter(f => TRACKED_EXTENSIONS.has(f.extension));
  }

  async getTrackedFiles(): Promise<TrackedFile[]> {
    const rawFiles = this.getRawTrackedFiles();

    const promises = rawFiles.map(f =>
      this.visitHistoryService.getLastVisitStamp(f).then(visitedMs => ({
        file: f,
        timeMetadata: {
          createdMs: f.stat.ctime,
          modifiedMs: f.stat.mtime,
          visitedMs,
        },
      }))
    );

    return Promise.all(promises);
  }
}