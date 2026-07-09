import { VHFileProvider } from "../../focusTracker/listener/VHFileProvider";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { TFile } from 'obsidian';
import { LRUCache } from 'lru-cache';

export interface VisitHistoryService {
  /** Records the visit to this file NOW. */
  recordVisitNowOnFocus(file: TFile): Promise<void>;

  /** Last visit stamp (epoch ms) across all devices, or null if never visited. */
  getLastVisitStamp(file: TFile): Promise<number | null>;
}

export class VisitHistoryServiceDefault implements VisitHistoryService {
  constructor(
    private readonly vhFileProvider: VHFileProvider,
    private readonly noteFileUtil: NoteFileUtil) {
  }

  // Cache to speed up retrieval of last visit metadata.
  // Values are wrapped in {value} so a cached "never visited" (null) result
  // stays distinguishable from a cache miss (LRUCache rejects nullish values).
  private readonly pathToLastVisit = new LRUCache<string, { value: number | null }>({
    // Set to high value as it will be of most use in very high note count vaults.
    max: 10000,
  });

  // VH file path of the most recently recorded visit.
  //
  // Dedup rule: skip recording only when the previous recorded visit went to
  // the SAME VH file (Obsidian can fire several leaf-change events for one
  // user action). Intentionally NOT time-window based — navigation pathways
  // between notes (A → B → A) are interesting data and must stay fully
  // recorded; a time window would silently drop the second A.
  private lastRecordedVhPath: string | null = null;

  async getLastVisitStamp(file: TFile): Promise<number | null> {
    const path = file.path;
    const cached = this.pathToLastVisit.get(path);
    if (cached) {
      return cached.value;
    }

    const vhFiles = await this.vhFileProvider.getAllVHFocusFiles(file);

    const stamps = await Promise.all(
      vhFiles.map(focusFile => focusFile.getLastStamp(this.noteFileUtil))
    );
    const validStamps = stamps.filter((stamp): stamp is number => stamp !== null);

    const lastVisit = validStamps.length > 0 ? Math.max(...validStamps) : null;
    this.pathToLastVisit.set(path, {value: lastVisit});
    return lastVisit;
  }

  async recordVisitNowOnFocus(file: TFile): Promise<void> {
    const vhFilePath = await this.vhFileProvider.getOrCreateVHFilePathForThisMachine(file);
    if (vhFilePath === null) {
      return;
    }

    if (this.lastRecordedVhPath === vhFilePath) {
      console.log("[VHP] Skip — last focus was already the same file.");
    } else {
      const nowStamp = Date.now();
      // Store as ISO 8601 UTC with milliseconds, e.g. "2026-06-23T12:34:56.789Z"
      const isoStamp = new Date(nowStamp).toISOString();

      console.log(`[VHP] Recording [${isoStamp}] as visit.`);

      await this.noteFileUtil.appendLineToNote(
        vhFilePath,
        isoStamp
      );

      this.pathToLastVisit.set(file.path, {value: nowStamp});
    }

    this.lastRecordedVhPath = vhFilePath;
  }
}
