import { TFile } from 'obsidian';
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";

/** File that contains the V1 focus visitation history. */
export class FocusFile {
  constructor(readonly file: TFile) {
  }

  async getLastStamp(noteFileUtil: NoteFileUtil): Promise<number> {
    const contents = await noteFileUtil.cachedRead(this.file);
    const lastLine = contents.split("\n").filter((line: string) => line.trim() !== "").at(-1);

    // Parse ISO 8601 UTC timestamp (e.g. "2026-06-23T12:34:56.789Z") or
    // legacy epoch-ms values (e.g. "1722234567890").
    if (!lastLine) {
      throw new Error(`No valid stamp found in ${this.file.path}`);
    }

    const parsed = Date.parse(lastLine);
    if (Number.isNaN(parsed)) {
      throw new Error(`No valid stamp found in ${this.file.path}`);
    }

    return parsed;
  }
}