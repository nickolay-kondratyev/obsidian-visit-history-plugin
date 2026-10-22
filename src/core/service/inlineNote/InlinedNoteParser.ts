import { FrontmatterBlock, FrontmatterBlocks } from './FrontmatterBlocks';
import { MarkdownStructure } from './MarkdownStructure';
import { NoteTitle } from './NoteTitle';

/** What the inlined note adds to the receiving note's frontmatter. */
export interface FrontmatterAdditions {
  /** Tag names without a leading `#`. */
  readonly tags: readonly string[];
  readonly aliases: readonly string[];
  /** Empty-value "tag property" keys (e.g. `locations:`). */
  readonly flagKeys: readonly string[];
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
}

const ID_KEY = 'id';
const TITLE_KEY = 'title';
const TAGS_KEY = 'tags';
const ALIASES_KEY = 'aliases';
const H1_LEVEL = 1;

/**
 * Splits note2 per the owner's frontmatter rules:
 * - `id` → dropped; `title` → consumed as the section title (see NoteTitle).
 * - `tags` → merged into note1 (not kept in the yaml block).
 * - `aliases` → merged into note1 AND kept in the yaml block.
 * - empty-value flag keys (`locations:`) → added to note1 when missing.
 * - all other properties → kept verbatim in the yaml block.
 */
export class InlinedNoteParser {
  static parse(content: string, basename: string): InlinedNote {
    const split = FrontmatterBlocks.split(content);
    const { blocks } = FrontmatterBlocks.parseBlocks(FrontmatterBlocks.frontmatterLines(split));
    const title = NoteTitle.resolve(content, basename);
    return {
      title,
      propertyLines: MarkdownStructure.trimBlankLines(
        blocks.filter(block => InlinedNoteParser.keepsInYamlBlock(block)).flatMap(block => block.lines),
      ),
      bodyLines: InlinedNoteParser.bodyWithoutTitleH1(FrontmatterBlocks.bodyLines(split), title),
      frontmatterAdditions: {
        tags: InlinedNoteParser.valuesOf(blocks, TAGS_KEY).map(tag => tag.replace(/^#/, '')),
        aliases: InlinedNoteParser.valuesOf(blocks, ALIASES_KEY),
        flagKeys: blocks.filter(block => InlinedNoteParser.isFlagKey(block)).map(block => block.key),
      },
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

  /** Trimmed body; a body STARTING with `# <title>` loses that H1 (no duplicate title). */
  private static bodyWithoutTitleH1(bodyLines: readonly string[], title: string): string[] {
    const trimmed = MarkdownStructure.trimBlankLines(bodyLines);
    const firstHeading = MarkdownStructure.parseHeading(trimmed[0] ?? '');
    if (firstHeading?.level === H1_LEVEL && firstHeading.text === title) {
      return MarkdownStructure.trimBlankLines(trimmed.slice(1));
    }
    return trimmed;
  }
}
