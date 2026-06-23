import { VHFileProvider } from "../../focusTracker/listener/VHFileProvider";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { TFile } from 'obsidian';
import { LRUCache } from 'lru-cache';

export interface VisitHistoryService {
  /** Records the visit to this file NOW. */
  recordVisitNowOnFocus(file: TFile): Promise<void>;

  getLastVisitStamp(file: TFile): Promise<number | null>;
}

// Cache to speed up retrieval of last visit metadata.
const pathToLastVisit = new LRUCache<string, { value: number | null }>({
  // Set to high value as it will be of most use in very high note count vaults.
  max: 10000,
});

export class VisitHistoryServiceDefault implements VisitHistoryService {
  constructor(
    private readonly vhFileProvider: VHFileProvider,
    private readonly noteFileUtil: NoteFileUtil) {
  }

  // Last recorded path of visit.
  private lastRecordedVhPath: string = "I_DONT_EXIST_PATH";

  async getLastVisitStamp(file: TFile): Promise<number | null> {
    let path = file.path;
    const cached = pathToLastVisit.get(path);
    if (cached) {
      return cached.value;
    }

    const vhFiles = await this.vhFileProvider.getAllVHFocusFiles(file);
    if (vhFiles.length === 0) {
      pathToLastVisit.set(path, {value: null});
      return null;
    }

    const stamps = await Promise.all(
      vhFiles.map(focusFile => focusFile.getLastStamp(this.noteFileUtil))
    );

    let lastVisit = Math.max(...stamps);
    pathToLastVisit.set(path, {value: lastVisit});
    return lastVisit;
  }

  async recordVisitNowOnFocus(file: TFile): Promise<void> {
    if (file === null) {
      console.log("[VHP] null file. skipping record");
      return;
    }

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

      pathToLastVisit.set(file.path, {value: nowStamp});
    }

    this.lastRecordedVhPath = vhFilePath;
  }
}