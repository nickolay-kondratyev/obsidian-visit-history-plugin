import { FrontmatterBlocks } from './FrontmatterBlocks';
import { MarkdownStructure } from './MarkdownStructure';

const TITLE_KEY = 'title';
const H1_LEVEL = 1;

/**
 * A note's display title for inline note: frontmatter `title` > first
 * `# H1` of the body > file name (without extension).
 */
export class NoteTitle {
  static resolve(content: string, basename: string): string {
    const split = FrontmatterBlocks.split(content);
    const titleBlock = FrontmatterBlocks.parseBlocks(FrontmatterBlocks.frontmatterLines(split)).blocks
      .find(block => block.key === TITLE_KEY);
    const frontmatterTitle = titleBlock === undefined ? '' : FrontmatterBlocks.unquote(titleBlock.inlineValue);
    if (frontmatterTitle !== '') {
      return frontmatterTitle;
    }
    const firstH1 = MarkdownStructure.headings(FrontmatterBlocks.bodyLines(split))
      .find(heading => heading.level === H1_LEVEL && heading.text !== '');
    return firstH1?.text ?? basename;
  }
}
