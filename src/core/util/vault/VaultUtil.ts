import { App, TFile } from 'obsidian';
import { FileTimeMetadata } from "../../data/FileTimeMetadata";
import { VisitStatsProvider } from "../../service/visitHistoryService/VisitStatsProvider";
import { IsTrackedProvider } from "./IsTrackedProvider";

export interface VaultUtil {
  getName(): string;

  /**
   * Tracked files WITHOUT time/visit metadata — cheap sync enumeration.
   * Use when last-visit stamps (doc-id reads) are not needed, e.g. content
   * matching (ContentTermMatcher).
   */
  getTrackedTFiles(): TFile[];

  getTrackedFiles(): Promise<TrackedFile[]>;
}

/** File in vault that is part of
 *  {@link TRACKED_EXTENSIONS} and is outside of the legacy _visit_history
 *  directory ({@link VISIT_HISTORY_TOP_DIR})
 *  */
export interface TrackedFile {
  file: TFile;
  timeMetadata: FileTimeMetadata,
}

export class VaultUtilDefault implements VaultUtil {
  constructor(
    private readonly app: App,
    private readonly visitStatsProvider: VisitStatsProvider,
    private readonly isTrackedProvider: IsTrackedProvider
  ) {
  }

  getName(): string {
    return this.app.vault.getName();
  }

  getTrackedTFiles(): TFile[] {
    return this.app.vault.getFiles()
      .filter(f => this.isTrackedProvider.isTrackedFile(f));
  }

  async getTrackedFiles(): Promise<TrackedFile[]> {
    const promises = this.getTrackedTFiles().map(f =>
      this.visitStatsProvider.getVisitStats(f).then(visitStats => ({
        file: f,
        timeMetadata: {
          createdMs: f.stat.ctime,
          modifiedMs: f.stat.mtime,
          visitedMs: visitStats.lastVisitMs,
          totalFocusMs: visitStats.totalFocusMs,
        },
      }))
    );

    return Promise.all(promises);
  }
}
