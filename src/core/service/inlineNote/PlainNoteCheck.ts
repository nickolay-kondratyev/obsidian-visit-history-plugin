import { TFile } from 'obsidian';
import { FrontmatterBlocks } from './FrontmatterBlocks';

const MARKDOWN_EXTENSION = 'md';
const EXCALIDRAW_MARKDOWN_SUFFIX = '.excalidraw.md';

/**
 * Inline note works only plain `.md` → plain `.md`: canvases and Excalidraw
 * drawings (incl. `.excalidraw.md`, which IS markdown) are refused on
 * either side (owner decision).
 */
export class PlainNoteCheck {
  /** The Excalidraw plugin marks its drawings with this frontmatter key. */
  static readonly EXCALIDRAW_FRONTMATTER_KEY = 'excalidraw-plugin';

  static isPlainMarkdownNote(file: TFile, content: string): boolean {
    if (!PlainNoteCheck.hasPlainMarkdownName(file)) {
      return false;
    }
    const frontmatterLines = FrontmatterBlocks.frontmatterLines(FrontmatterBlocks.split(content));
    return !FrontmatterBlocks.parseBlocks(frontmatterLines).blocks
      .some(block => block.key === PlainNoteCheck.EXCALIDRAW_FRONTMATTER_KEY);
  }

  /** The name-only half of the check: `.md`, but not `.excalidraw.md`. */
  static hasPlainMarkdownName(file: TFile): boolean {
    return file.extension === MARKDOWN_EXTENSION && !file.name.endsWith(EXCALIDRAW_MARKDOWN_SUFFIX);
  }
}
