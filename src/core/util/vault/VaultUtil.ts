import { App, normalizePath, TFile } from 'obsidian';
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

  /**
   * The tracked file at a vault-relative path with its time/visit metadata
   * (same metadata as {@link getTrackedFiles}), or undefined when no file
   * exists there or it is not tracked. Read-only.
   */
  getTrackedFile(path: string): Promise<TrackedFile | undefined>;
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
    return Promise.all(this.getTrackedTFiles().map(f => this.toTrackedFile(f)));
  }

  async getTrackedFile(path: string): Promise<TrackedFile | undefined> {
    const file = this.app.vault.getFileByPath(normalizePath(path));
    if (file === null || !this.isTrackedProvider.isTrackedFile(file)) {
      return undefined;
    }
    return this.toTrackedFile(file);
  }

  /** The ONE mapping of a tracked file onto its time metadata (heatmap + API read the same). */
  private async toTrackedFile(file: TFile): Promise<TrackedFile> {
    const visitStats = await this.visitStatsProvider.getVisitStats(file);
    return {
      file,
      timeMetadata: {
        createdMs: file.stat.ctime,
        modifiedMs: file.stat.mtime,
        visitedMs: visitStats.lastVisitMs,
        totalFocusMs: visitStats.totalFocusMs,
      },
    };
  }
}
