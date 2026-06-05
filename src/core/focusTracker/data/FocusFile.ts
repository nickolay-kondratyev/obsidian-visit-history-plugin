import { TFile } from 'obsidian';
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";

/** File that contains the V1 focus visitation history. */
export class FocusFile {
  constructor(readonly file: TFile) {
  }

  async getLastStamp(noteFileUtil: NoteFileUtil): Promise<number> {
    const contents = await noteFileUtil.cachedRead(this.file);
    const lastLine = contents.split("\n").filter((line: string) => line.trim() !== "").at(-1);

    if (!lastLine || Number.isNaN(Number(lastLine))) {
      throw new Error(`No valid stamp found in ${this.file.path}`);
    }

    return Number(lastLine);
  }
}