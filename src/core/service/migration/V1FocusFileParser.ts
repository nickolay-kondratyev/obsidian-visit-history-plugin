import { StampLineParser } from '../../util/time/StampLineParser';

// Line 1 of every V1 VH file: `VISIT_HISTORY_V1_FOR:[[<link to source note>]]`.
const V1_BACKLINK_LINE_PATTERN = /^VISIT_HISTORY_V1_FOR:\[\[(.+?)\]\]/m;

/** Parsed content of one V1 focus file. */
export interface V1ParsedFocusFile {
  /**
   * The wiki-link text tying the VH file to its source note, or null when the
   * backlink line is missing/corrupt. Alias (`|...`) and heading (`#...`)
   * suffixes are stripped. May be a full vault path OR a shortest-unique name
   * — Obsidian rewrites links per the user's link-format setting on renames,
   * so callers must resolve it via the metadata cache, not by literal path.
   */
  backlinkTargetLinkText: string | null;
  /** Every parseable visit stamp, in file order (ISO or legacy epoch-ms lines). */
  stampsMs: number[];
}

/**
 * Parser for the V1 on-disk focus-file format — kept only as MIGRATION INPUT
 * (the V1 write path is gone). Never throws on malformed content: one bad
 * file must not break the vault-wide migration.
 */
export class V1FocusFileParser {
  static parse(content: string): V1ParsedFocusFile {
    return {
      backlinkTargetLinkText: V1FocusFileParser.parseBacklinkTarget(content),
      stampsMs: content
        .split('\n')
        .map(line => StampLineParser.parseLegacyOrIsoMs(line))
        .filter((ms): ms is number => ms !== null),
    };
  }

  private static parseBacklinkTarget(content: string): string | null {
    const rawTarget = V1_BACKLINK_LINE_PATTERN.exec(content)?.[1];
    if (!rawTarget) {
      return null;
    }
    // Strip alias and heading parts: `path|alias`, `path#heading`.
    const target = rawTarget.split('|')[0]!.split('#')[0]!.trim();
    return target.length > 0 ? target : null;
  }
}
