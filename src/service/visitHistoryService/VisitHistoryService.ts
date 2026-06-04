import { VHFileProvider } from "../../focusTracker/listener/VHFileProvider";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { FocusEvent } from "../../focusTracker/FocusTracker";
import { Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';

export interface VisitHistoryService {
  /** Records the visit to this file NOW. */
  recordVisitNowOnFocus(file: TFile): Promise<void>;
}

export class VisitHistoryServiceDefault implements VisitHistoryService {
  constructor(
    private readonly vhFileProvider: VHFileProvider,
    private readonly noteFileUtil: NoteFileUtil) {
  }

  // Last recorded path of visit.
  private lastRecordedVhPath: string = "I_DONT_EXIST_PATH";

  async recordVisitNowOnFocus(file: TFile): Promise<void> {
    if (file === null){
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
      const nowStampMillis = Date.now().toString();

      console.log(`[VHP] Recording [${nowStampMillis}] as visit.`);

      await this.noteFileUtil.appendLineToNote(
        vhFilePath,
        nowStampMillis
      );
    }

    this.lastRecordedVhPath = vhFilePath;
  }
}