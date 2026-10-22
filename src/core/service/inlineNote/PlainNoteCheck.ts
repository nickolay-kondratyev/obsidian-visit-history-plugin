import { TFile } from 'obsidian';
import { FrontmatterBlocks } from './FrontmatterBlocks';

const MARKDOWN_EXTENSION = 'md';
const EXCALIDRAW_MARKDOWN_SUFFIX = '.excalidraw.md';
// The Excalidraw plugin marks its drawings with this frontmatter key.
const EXCALIDRAW_FRONTMATTER_KEY = 'excalidraw-plugin';

/**
 * Inline note works only plain `.md` → plain `.md`: canvases and Excalidraw
 * drawings (incl. `.excalidraw.md`, which IS markdown) are refused on
 * either side (owner decision).
 */
export class PlainNoteCheck {
  static isPlainMarkdownNote(file: TFile, content: string): boolean {
    if (file.extension !== MARKDOWN_EXTENSION || file.name.endsWith(EXCALIDRAW_MARKDOWN_SUFFIX)) {
      return false;
    }
    const frontmatterLines = FrontmatterBlocks.frontmatterLines(FrontmatterBlocks.split(content));
    return !FrontmatterBlocks.parseBlocks(frontmatterLines).blocks
      .some(block => block.key === EXCALIDRAW_FRONTMATTER_KEY);
  }
}
