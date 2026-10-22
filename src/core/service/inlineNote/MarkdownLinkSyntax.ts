/** One internal link as written in markdown text. */
export interface ParsedLink {
  readonly isEmbed: boolean;
  /** Path part of the link target ('' for a same-note link like `[[#Heading]]`). */
  readonly linkpath: string;
  /** '' for a whole-note link; else from `#` on, e.g. `#Heading`, `#^block`. */
  readonly subpath: string;
  /** Display text (`[[x|alias]]` / `[alias](x.md)`), undefined when none. */
  readonly alias: string | undefined;
}

// [[target]] / [[target|alias]] / ![[...]] — target and alias contain no
// brackets; the alias may contain anything else.
const WIKILINK_RE = /(!?)\[\[([^[\]|]*)(?:\|([^[\]]*))?\]\]/g;
// [alias](target) / ![alias](target) — target optionally <wrapped>.
const MARKDOWN_LINK_RE = /(!?)\[([^\]]*)\]\(([^)]*)\)/g;
// Anything with a URI scheme (https:, mailto:, obsidian:, …) is not a vault link.
const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Parses Obsidian internal links out of markdown text — wikilinks and
 * markdown-style links. Used where Obsidian's metadataCache gives us no
 * parsed links (canvas text cards) and to read the alias of a cached link
 * from its `original` text.
 */
export class MarkdownLinkSyntax {
  /** The link written exactly as `original`, or null when it is not one. */
  static parse(original: string): ParsedLink | null {
    const links = MarkdownLinkSyntax.findAll(original);
    return links.length === 1 && links[0]?.matchedText === original ? links[0].link : null;
  }

  /** Every internal link in the text, in order. */
  static findAllLinks(text: string): ParsedLink[] {
    return MarkdownLinkSyntax.findAll(text).map(found => found.link);
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static findAll(text: string): { link: ParsedLink; matchedText: string }[] {
    const found: { link: ParsedLink; matchedText: string; index: number }[] = [];
    for (const match of text.matchAll(WIKILINK_RE)) {
      const alias = match[3];
      found.push({
        link: MarkdownLinkSyntax.build(match[1] === '!', match[2] ?? '', alias === undefined || alias === '' ? undefined : alias),
        matchedText: match[0],
        index: match.index,
      });
    }
    for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
      const target = MarkdownLinkSyntax.decodeTarget(match[3] ?? '');
      if (target === null || URI_SCHEME_RE.test(target)) {
        continue;
      }
      const alias = match[2];
      found.push({
        link: MarkdownLinkSyntax.build(match[1] === '!', target, alias === undefined || alias === '' ? undefined : alias),
        matchedText: match[0],
        index: match.index,
      });
    }
    return found.sort((a, b) => a.index - b.index);
  }

  private static build(isEmbed: boolean, target: string, alias: string | undefined): ParsedLink {
    const hashIndex = target.indexOf('#');
    return hashIndex < 0
      ? { isEmbed, linkpath: target.trim(), subpath: '', alias }
      : { isEmbed, linkpath: target.slice(0, hashIndex).trim(), subpath: target.slice(hashIndex).trim(), alias };
  }

  /** Strips `<…>` wrapping and URL-decodes (`%20`); null when undecodable. */
  private static decodeTarget(rawTarget: string): string | null {
    const trimmed = rawTarget.trim();
    const unwrapped = trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1) : trimmed;
    try {
      return decodeURI(unwrapped);
    } catch {
      return null;
    }
  }
}
