import { FrontmatterBlock, FrontmatterBlocks, FrontmatterSplit } from './FrontmatterBlocks';
import { MarkdownStructure } from './MarkdownStructure';
import { NoteTitle } from './NoteTitle';
import { WholeNoteSelfLinkAt } from './SelfLinkRewriter';

/** What the inlined note adds to the receiving note's frontmatter. */
export interface FrontmatterAdditions {
  /** Tag names without a leading `#`. */
  readonly tags: readonly string[];
  readonly aliases: readonly string[];
  /** Empty-value "tag property" keys (e.g. `locations:`). */
  readonly flagKeys: readonly string[];
}

/** A whole-note link from note2 to itself, located in `InlinedNote.bodyLines`. */
export interface WholeNoteSelfLink {
  readonly lineIndex: number;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly isEmbed: boolean;
  readonly alias: string | undefined;
}

/** The inlined note (note2), taken apart for placement into note1. */
export interface InlinedNote {
  /** Heading text of the inlined section. */
  readonly title: string;
  /** Leftover properties as raw YAML lines, shown in a fenced yaml block ([] when none). */
  readonly propertyLines: readonly string[];
  /** Body lines, headings NOT yet shifted; a leading duplicate-title H1 is dropped. */
  readonly bodyLines: readonly string[];
  readonly frontmatterAdditions: FrontmatterAdditions;
  /** Become links to the new section once placed (see MarkdownSectionPlacer). */
  readonly wholeNoteSelfLinks: readonly WholeNoteSelfLink[];
}

const ID_KEY = 'id';
const TITLE_KEY = 'title';
const TAGS_KEY = 'tags';
const ALIASES_KEY = 'aliases';
const H1_LEVEL = 1;

/** Half-open line index range [start, end). */
interface LineRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Splits note2 per the owner's frontmatter rules:
 * - `id` → dropped; `title` → consumed as the section title (see NoteTitle).
 * - `tags` → merged into note1 (not kept in the yaml block).
 * - `aliases` → merged into note1 AND kept in the yaml block.
 * - empty-value flag keys (`locations:`) → added to note1 when missing.
 * - all other properties → kept verbatim in the yaml block.
 */
export class InlinedNoteParser {
  /** @param wholeNoteSelfLinks offsets into `content` (see SelfLinkRewriter). */
  static parse(content: string, basename: string, wholeNoteSelfLinks: readonly WholeNoteSelfLinkAt[] = []): InlinedNote {
    const split = FrontmatterBlocks.split(content);
    const { blocks } = FrontmatterBlocks.parseBlocks(FrontmatterBlocks.frontmatterLines(split));
    const title = NoteTitle.resolve(content, basename);
    const body = InlinedNoteParser.keptBodyRange(split, title);
    return {
      title,
      propertyLines: MarkdownStructure.trimBlankLines(
        blocks.filter(block => InlinedNoteParser.keepsInYamlBlock(block)).flatMap(block => block.lines),
      ),
      bodyLines: split.lines.slice(body.start, body.end),
      frontmatterAdditions: {
        tags: InlinedNoteParser.valuesOf(blocks, TAGS_KEY).map(tag => tag.replace(/^#/, '')),
        aliases: InlinedNoteParser.valuesOf(blocks, ALIASES_KEY),
        flagKeys: blocks.filter(block => InlinedNoteParser.isFlagKey(block)).map(block => block.key),
      },
      wholeNoteSelfLinks: InlinedNoteParser.inBodyCoordinates(content, wholeNoteSelfLinks, body),
    };
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static keepsInYamlBlock(block: FrontmatterBlock): boolean {
    if (block.key === ID_KEY || block.key === TITLE_KEY || block.key === TAGS_KEY) {
      return false;
    }
    return !InlinedNoteParser.isFlagKey(block);
  }

  private static isFlagKey(block: FrontmatterBlock): boolean {
    const consumedKeys = [ID_KEY, TITLE_KEY, TAGS_KEY, ALIASES_KEY];
    return !consumedKeys.includes(block.key) && FrontmatterBlocks.isEmptyValue(block);
  }

  private static valuesOf(blocks: readonly FrontmatterBlock[], key: string): string[] {
    return blocks.filter(block => block.key === key).flatMap(block => FrontmatterBlocks.listValues(block));
  }

  /**
   * Line range [start, end) of the kept body: blank-trimmed; a body STARTING
   * with `# <title>` loses that H1 (no duplicate title).
   */
  private static keptBodyRange(split: FrontmatterSplit, title: string): LineRange {
    const bodyStart = split.closingFenceIndex === null ? 0 : split.closingFenceIndex + 1;
    let range = InlinedNoteParser.trimmedRange(split.lines, bodyStart, split.lines.length);
    const firstHeading = MarkdownStructure.parseHeading(split.lines[range.start] ?? '');
    if (range.start < range.end && firstHeading?.level === H1_LEVEL && firstHeading.text === title) {
      range = InlinedNoteParser.trimmedRange(split.lines, range.start + 1, range.end);
    }
    return range;
  }

  private static trimmedRange(lines: readonly string[], start: number, end: number): LineRange {
    const isBlank = (index: number): boolean => (lines[index] ?? '').trim() === '';
    while (start < end && isBlank(start)) start++;
    while (end > start && isBlank(end - 1)) end--;
    return { start, end };
  }

  /** Self-links inside the kept body, positioned by body line + column (others are dropped). */
  private static inBodyCoordinates(
    content: string,
    links: readonly WholeNoteSelfLinkAt[],
    body: LineRange,
  ): WholeNoteSelfLink[] {
    const lineStarts = [0];
    for (let index = content.indexOf('\n'); index >= 0; index = content.indexOf('\n', index + 1)) {
      lineStarts.push(index + 1);
    }
    return links.flatMap((link) => {
      let lineIndex = 0;
      while ((lineStarts[lineIndex + 1] ?? Infinity) <= link.startOffset) lineIndex++;
      const lineStart = lineStarts[lineIndex] ?? 0;
      if (lineIndex < body.start || lineIndex >= body.end) {
        return [];
      }
      return [{
        lineIndex: lineIndex - body.start,
        startColumn: link.startOffset - lineStart,
        endColumn: link.endOffset - lineStart,
        isEmbed: link.isEmbed,
        alias: link.alias,
      }];
    });
  }
}
