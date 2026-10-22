import { FrontmatterBlocks } from './FrontmatterBlocks';
import { InlinedNote } from './InlinedNoteParser';
import { LineEnding } from './LineEnding';
import { MarkdownLinkSyntax } from './MarkdownLinkSyntax';
import { MAX_HEADING_LEVEL, MarkdownHeading, MarkdownStructure } from './MarkdownStructure';

/** Where the ONE link to the inlined note sits in the receiving note. */
export interface InlineLinkSite {
  readonly startOffset: number;
  readonly endOffset: number;
  /** The link exactly as written — re-checked at the offsets before editing. */
  readonly original: string;
  readonly isEmbed: boolean;
}

export type PlacementResult =
  | { readonly kind: 'placed'; readonly content: string }
  /** A heading would pass `######`. */
  | { readonly kind: 'too-deep' }
  /**
   * The link sits in a heading line: removing it would leave an empty or
   * changed heading (plus a stray `-continued` one) — the user moves it.
   */
  | { readonly kind: 'link-in-heading' }
  /** The link is no longer at its offsets (note changed since indexing). */
  | { readonly kind: 'link-moved' };

type ContainerKind = 'list' | 'quote' | 'table';

/** Title level when no heading (or only an H1) encloses the link. */
const TOP_LEVEL_TITLE_LEVEL = 2;
const CONTINUED_SUFFIX = '-continued';
// WHAT: list item marker (`-`, `*`, `+`, `1.`, `1)`) followed by space/EOL.
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])(?:\s|$)/;
const INDENTED_RE = /^\s+\S/;
const QUOTE_RE = /^\s*>/;
const TABLE_ROW_RE = /^\s*\|/;
// WHAT: Obsidian's own stripHeadingForLink set (`: # | ^ \ CR LF`, `%%`, `[[`, `]]`)
// plus lone brackets (our link parser rejects them). Obsidian 1.12.7 source:
// `/([:#|^\\\r\n]|%%|\[\[|]])/g`. Safe to blank out: resolveSubpath compares
// both sides through stripHeading (a superset), so the target still resolves.
const HEADING_LINK_UNSAFE_RE = /[[\]:#|^\\\r\n]|%%/g;
// WHAT: Obsidian's stripHeading set (1.12.7) — how resolveSubpath compares
// heading texts (with whitespace collapsed + lowercased).
const HEADING_MATCH_STRIPPED_RE = /[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\\r\n]/g;
const LINK_DISPLAY_UNSAFE_RE = /[[\]|]|%%/g;

/**
 * Places the inlined note's section into the receiving note (pure text):
 *
 *   ### Third
 *   See note2 for details.     <- link line (regular link → plain text; embed → removed)
 *   #### <note2 title>         <- enclosing level + 1 (`##` when no heading encloses)
 *   ```yaml ... ```            <- leftover properties
 *   ...note2 body...           <- headings shifted under the title, relative depth kept
 *   #### Third-continued       <- ONLY if loose text followed the link line
 *   More text of Third.
 *
 * A link inside a list / callout / quote / table never splits it: the block
 * goes after the container's end and the link becomes a same-note heading
 * link `[[#<title>|<alias, else title>]]` (owner decisions, see ticket
 * nid_jlkies6u31pmfft2gu3qwom96_e). The result keeps note1's line ending
 * (LineEnding).
 */
export class MarkdownSectionPlacer {
  static place(content: string, receivingTitle: string, link: InlineLinkSite, inlined: InlinedNote): PlacementResult {
    if (content.slice(link.startOffset, link.endOffset) !== link.original) {
      return { kind: 'link-moved' };
    }
    const lines = content.split('\n');
    const lineStarts = MarkdownSectionPlacer.lineStartOffsets(lines);
    const linkLine = MarkdownSectionPlacer.lineIndexAt(lineStarts, link.startOffset);
    const linkEndLine = MarkdownSectionPlacer.lineIndexAt(lineStarts, link.endOffset);
    const split = FrontmatterBlocks.split(content);
    const bodyStart = split.closingFenceIndex === null ? 0 : split.closingFenceIndex + 1;
    if (linkLine < bodyStart) {
      return { kind: 'link-moved' };
    }

    const headings = MarkdownStructure.headings(lines, bodyStart);
    const enclosing = headings.filter(heading => heading.lineIndex <= linkLine).at(-1);
    if (enclosing !== undefined && enclosing.lineIndex === linkLine) {
      return { kind: 'link-in-heading' };
    }
    const titleLevel = enclosing === undefined ? TOP_LEVEL_TITLE_LEVEL : Math.max(TOP_LEVEL_TITLE_LEVEL, enclosing.level + 1);
    const bodyHeadingDelta = MarkdownSectionPlacer.bodyHeadingDelta(inlined.bodyLines, titleLevel);
    if (bodyHeadingDelta === null) {
      return { kind: 'too-deep' };
    }

    const container = MarkdownSectionPlacer.containerKindAt(lines, linkLine, bodyStart);
    const alias = MarkdownLinkSyntax.parse(link.original)?.alias;
    const replacement = container === null
      ? (link.isEmbed ? '' : alias ?? inlined.title)
      : MarkdownSectionPlacer.headingLink(container, inlined.title, alias, enclosing, headings);
    const spanStart = lineStarts[linkLine] ?? 0;
    const spanEnd = (lineStarts[linkEndLine] ?? 0) + (lines[linkEndLine] ?? '').length;
    const rewrittenSpan = content.slice(spanStart, link.startOffset) + replacement + content.slice(link.endOffset, spanEnd);
    const rewrittenSpanLines = link.isEmbed && container === null && rewrittenSpan.trim() === ''
      ? []
      : rewrittenSpan.split('\n');

    const insertAfter = container === null ? linkEndLine : MarkdownSectionPlacer.containerEnd(lines, linkEndLine, container);
    const continuationText = enclosing === undefined ? receivingTitle : enclosing.text;
    const titlePrefix = '#'.repeat(titleLevel);
    const continuation = MarkdownSectionPlacer.hasLooseTextAfter(lines, insertAfter, headings)
      ? [`${titlePrefix} ${continuationText}${CONTINUED_SUFFIX}`]
      : [];
    const block = [
      `${titlePrefix} ${inlined.title}`,
      ...(inlined.propertyLines.length > 0 ? ['```yaml', ...inlined.propertyLines, '```'] : []),
      ...MarkdownStructure.shiftHeadings(inlined.bodyLines, bodyHeadingDelta),
    ];
    // Offsets above index the raw text, so `lines` keep their CR until here.
    return {
      kind: 'placed',
      content: LineEnding.joinLines([
        ...lines.slice(0, linkLine),
        ...rewrittenSpanLines,
        ...lines.slice(linkEndLine + 1, insertAfter + 1),
        ...block,
        ...continuation,
        ...lines.slice(insertAfter + 1),
      ], LineEnding.detect(content)),
    };
  }

  // ── private ─────────────────────────────────────────────────────────────

  /**
   * Level shift putting the body's shallowest heading right under the title
   * (relative depth kept); null when the title or any shifted heading would
   * pass MAX_HEADING_LEVEL.
   */
  private static bodyHeadingDelta(bodyLines: readonly string[], titleLevel: number): number | null {
    if (titleLevel > MAX_HEADING_LEVEL) {
      return null;
    }
    const levels = MarkdownStructure.headings(bodyLines).map(heading => heading.level);
    if (levels.length === 0) {
      return 0;
    }
    const delta = titleLevel + 1 - Math.min(...levels);
    return Math.max(...levels) + delta > MAX_HEADING_LEVEL ? null : delta;
  }

  /**
   * `[[#<title>|<display>]]` — or the nested `[[#<enclosing>#<title>|…]]`
   * when note1 already has a heading with the title's text (a bare link
   * would resolve to that older heading). Characters a heading link can't
   * hold are blanked like Obsidian's own link autocomplete does (see
   * HEADING_LINK_UNSAFE_RE); "same text" is judged the way Obsidian matches.
   */
  private static headingLink(
    container: ContainerKind,
    title: string,
    alias: string | undefined,
    enclosing: MarkdownHeading | undefined,
    headings: readonly MarkdownHeading[],
  ): string {
    const titleTarget = MarkdownSectionPlacer.cleanLinkText(title, HEADING_LINK_UNSAFE_RE);
    const titleKey = MarkdownSectionPlacer.headingMatchKey(title);
    const collides = headings.some(heading => MarkdownSectionPlacer.headingMatchKey(heading.text) === titleKey);
    const target = collides && enclosing !== undefined
      ? `${MarkdownSectionPlacer.cleanLinkText(enclosing.text, HEADING_LINK_UNSAFE_RE)}#${titleTarget}`
      : titleTarget;
    // A bare `|` inside a table row would split the cell.
    const pipe = container === 'table' ? '\\|' : '|';
    return `[[#${target}${pipe}${MarkdownSectionPlacer.cleanLinkText(alias ?? title, LINK_DISPLAY_UNSAFE_RE)}]]`;
  }

  /** How Obsidian's resolveSubpath compares a heading with a link part. */
  private static headingMatchKey(text: string): string {
    return MarkdownSectionPlacer.cleanLinkText(text, HEADING_MATCH_STRIPPED_RE).toLowerCase();
  }

  private static cleanLinkText(text: string, unsafe: RegExp): string {
    return text.replace(unsafe, ' ').replace(/\s+/g, ' ').trim();
  }

  private static containerKindAt(lines: readonly string[], lineIndex: number, bodyStart: number): ContainerKind | null {
    const line = lines[lineIndex] ?? '';
    if (LIST_ITEM_RE.test(line)) return 'list';
    if (QUOTE_RE.test(line)) return 'quote';
    if (TABLE_ROW_RE.test(line)) return 'table';
    if (INDENTED_RE.test(line)) {
      // An indented line continues the list item above it (no blank between).
      for (let index = lineIndex - 1; index >= bodyStart && (lines[index] ?? '').trim() !== ''; index--) {
        if (LIST_ITEM_RE.test(lines[index] ?? '')) return 'list';
      }
    }
    return null;
  }

  /** Index of the container's last line, scanning down from `fromLine`. */
  private static containerEnd(lines: readonly string[], fromLine: number, container: ContainerKind): number {
    let end = fromLine;
    for (let index = fromLine + 1; index < lines.length; index++) {
      const line = lines[index] ?? '';
      if (MarkdownSectionPlacer.continuesContainer(line, container)) {
        end = index;
      } else if (container === 'list' && line.trim() === '') {
        // A loose list continues across blank lines when an item / indented
        // continuation follows; otherwise the blank line ends it.
        const next = lines.slice(index + 1).find(candidate => candidate.trim() !== '');
        if (next === undefined || !MarkdownSectionPlacer.continuesContainer(next, container)) break;
      } else {
        break;
      }
    }
    return end;
  }

  private static continuesContainer(line: string, container: ContainerKind): boolean {
    switch (container) {
      case 'list': return LIST_ITEM_RE.test(line) || INDENTED_RE.test(line);
      case 'quote': return QUOTE_RE.test(line);
      case 'table': return TABLE_ROW_RE.test(line);
    }
  }

  /** True when non-blank text sits between `afterLine` and the next heading. */
  private static hasLooseTextAfter(lines: readonly string[], afterLine: number, headings: readonly MarkdownHeading[]): boolean {
    const nextHeadingLine = headings.find(heading => heading.lineIndex > afterLine)?.lineIndex ?? lines.length;
    return lines.slice(afterLine + 1, nextHeadingLine).some(line => line.trim() !== '');
  }

  private static lineStartOffsets(lines: readonly string[]): number[] {
    const starts: number[] = [];
    let offset = 0;
    for (const line of lines) {
      starts.push(offset);
      offset += line.length + 1;
    }
    return starts;
  }

  private static lineIndexAt(lineStarts: readonly number[], offset: number): number {
    let index = 0;
    while (index + 1 < lineStarts.length && (lineStarts[index + 1] ?? Infinity) <= offset) index++;
    return index;
  }
}
