import { BodyNoteReference } from './NoteReference';
import { MarkdownLinkSyntax } from './MarkdownLinkSyntax';

/** A link inside note2 that points at note2 itself (as found by the link census). */
export type SelfLinkSite = Pick<BodyNoteReference, 'startOffset' | 'endOffset' | 'original' | 'isEmbed' | 'subpath'>;

/** A whole-note self-link left in the text: it can only become a link once note2's section exists in note1. */
export interface WholeNoteSelfLinkAt {
  /** Offsets in the REWRITTEN content. */
  readonly startOffset: number;
  readonly endOffset: number;
  readonly isEmbed: boolean;
  readonly alias: string | undefined;
}

export interface SelfLinkRewrite {
  readonly content: string;
  readonly wholeNoteLinks: readonly WholeNoteSelfLinkAt[];
}

// WHAT: `[[` / `![[`, then the link path (dropped), then `#subpath…]]` (kept).
// The first `#` is in the target: the target precedes any `|alias`.
const WIKILINK_PATH_RE = /^(!?\[\[)[^#]*(#.*)$/s;
// WHAT: `[alias](` + optional `<`, then the path (dropped), then `#subpath…)` (kept).
// The alias ends at the FIRST `](` (it may hold brackets, e.g. `[see [x]](…)`).
const MARKDOWN_LINK_PATH_RE = /^(!?\[.*?\]\(\s*<?)[^#]*(#.*)$/s;

/**
 * Keeps note2's links to itself working once its text lives inside note1
 * (owner decision, ticket nid_g093hvhy7cn5bfyigkjhdp9w7_e):
 * - a link to a part (`[[note2#X|a]]`, `![[note2#^b]]`) drops its path and
 *   becomes same-note (`[[#X|a]]`, `![[#^b]]`) — the heading/block moves along;
 * - a whole-note link is left as is and reported, so MarkdownSectionPlacer
 *   can turn it into a link to the new section (its target depends on note1).
 * Positions come from metadataCache; each is re-checked — nothing is guessed.
 */
export class SelfLinkRewriter {
  /** @returns null when a link is no longer at its offsets (note2 changed since indexing). */
  static rewrite(content: string, selfLinks: readonly SelfLinkSite[]): SelfLinkRewrite | null {
    const ordered = [...selfLinks].sort((a, b) => a.startOffset - b.startOffset);
    let rewritten = '';
    let copiedUpTo = 0;
    const wholeNoteLinks: WholeNoteSelfLinkAt[] = [];
    for (const link of ordered) {
      if (link.startOffset < copiedUpTo || content.slice(link.startOffset, link.endOffset) !== link.original) {
        return null;
      }
      rewritten += content.slice(copiedUpTo, link.startOffset);
      if (link.subpath === '') {
        wholeNoteLinks.push({
          startOffset: rewritten.length,
          endOffset: rewritten.length + link.original.length,
          isEmbed: link.isEmbed,
          alias: MarkdownLinkSyntax.parse(link.original)?.alias,
        });
        rewritten += link.original;
      } else {
        rewritten += SelfLinkRewriter.withoutPath(link.original);
      }
      copiedUpTo = link.endOffset;
    }
    return { content: rewritten + content.slice(copiedUpTo), wholeNoteLinks };
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static withoutPath(original: string): string {
    const pattern = original.startsWith('[[') || original.startsWith('![[') ? WIKILINK_PATH_RE : MARKDOWN_LINK_PATH_RE;
    if (!pattern.test(original)) {
      // Obsidian caches only wikilinks and markdown links — anything else is a bug, not a user error.
      throw new Error(`Unrecognized self-link syntax original=[${original}]`);
    }
    return original.replace(pattern, '$1$2');
  }
}
