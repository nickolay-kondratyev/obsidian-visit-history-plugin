import { TFile } from 'obsidian';
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";

// Strict stamp formats. Intentionally NOT a bare Date.parse — it accepts loose
// strings ("March 2026") and would misread header/comment lines as stamps.
const LEGACY_EPOCH_MS_PATTERN = /^\d+$/;
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** File that contains the V1 focus visitation history. */
export class FocusFile {
  constructor(readonly file: TFile) {
  }

  /**
   * Returns the most recent visit stamp (epoch ms), or null when the file
   * contains no stamp yet (e.g. freshly created header-only file).
   *
   * Never throws on malformed content: one bad VH file must not break
   * aggregation across all VH files (callers Promise.all over these).
   */
  async getLastStamp(noteFileUtil: NoteFileUtil): Promise<number | null> {
    const contents = await noteFileUtil.cachedRead(this.file);
    const lines = contents.split("\n");

    // Scan from the end: stamps are append-only, so the last parseable line
    // is the most recent visit. Header/comment lines are skipped.
    for (let i = lines.length - 1; i >= 0; i--) {
      const stamp = FocusFile.parseStampLine(lines[i]!);
      if (stamp !== null) return stamp;
    }

    return null;
  }

  private static parseStampLine(rawLine: string): number | null {
    const line = rawLine.trim();
    if (LEGACY_EPOCH_MS_PATTERN.test(line)) return Number(line);
    if (ISO_8601_PATTERN.test(line)) return Date.parse(line);
    return null;
  }
}
