import { LineEnding } from './LineEnding';

/** A note's lines split at its frontmatter fences. */
export interface FrontmatterSplit {
  /** All lines of the note (split on `\n`, without CR — see LineEnding). */
  readonly lines: readonly string[];
  /** Index of the closing `---` fence; null when the note has no frontmatter. */
  readonly closingFenceIndex: number | null;
}

/** One top-level property of a frontmatter block, as raw text. */
export interface FrontmatterBlock {
  readonly key: string;
  /** Text after `key:` on the key line, trimmed ('' when none). */
  readonly inlineValue: string;
  /** Raw lines: the key line followed by its continuation lines. */
  readonly lines: readonly string[];
}

const FENCE = '---';
const YAML_DOCUMENT_END = '...';
// A top-level key line: no leading space, not a list item / comment; the key
// may be quoted. Groups: 1 = key (quotes kept), 2 = rest of the line.
const KEY_LINE_RE = /^("[^"]*"|'[^']*'|[^\s#\-"'][^:]*?)\s*:(?:\s(.*)|$)/;
// A block-sequence item: `- value` (any indent). Group 1 = value.
const SEQUENCE_ITEM_RE = /^\s*-\s+(.*)$/;

/**
 * Raw-text view of YAML frontmatter, split into top-level property blocks.
 *
 * WHY raw text (not a YAML parser + re-serializer): edits to a note's
 * frontmatter must touch ONLY what they add — re-serializing would reformat
 * keys we don't own (see CLAUDE.md "Doc ids": why processFrontMatter is not
 * used). Ceiling: covers the YAML Obsidian's property editor writes (flat
 * keys; scalar, flow `[a, b]` and block `- a` lists); exotic YAML (anchors,
 * multi-line flow lists) is carried through verbatim but not interpreted.
 */
export class FrontmatterBlocks {
  static split(content: string): FrontmatterSplit {
    const lines = LineEnding.splitLines(content);
    if (FrontmatterBlocks.trimmed(lines[0]) !== FENCE) {
      return { lines, closingFenceIndex: null };
    }
    for (let index = 1; index < lines.length; index++) {
      const line = FrontmatterBlocks.trimmed(lines[index]);
      if (line === FENCE || line === YAML_DOCUMENT_END) {
        return { lines, closingFenceIndex: index };
      }
    }
    return { lines, closingFenceIndex: null };
  }

  /** The frontmatter lines between the fences ([] when none). */
  static frontmatterLines(split: FrontmatterSplit): string[] {
    return split.closingFenceIndex === null ? [] : split.lines.slice(1, split.closingFenceIndex);
  }

  /** Body lines after the closing fence (all lines when no frontmatter). */
  static bodyLines(split: FrontmatterSplit): string[] {
    return split.closingFenceIndex === null ? [...split.lines] : split.lines.slice(split.closingFenceIndex + 1);
  }

  /**
   * Top-level blocks. Lines before the first key (comments, blanks) are not
   * part of any block and are returned as `preambleLines`.
   */
  static parseBlocks(frontmatterLines: readonly string[]): { preambleLines: string[]; blocks: FrontmatterBlock[] } {
    const preambleLines: string[] = [];
    const blocks: { key: string; inlineValue: string; lines: string[] }[] = [];
    for (const line of frontmatterLines) {
      const keyMatch = KEY_LINE_RE.exec(line);
      if (keyMatch !== null) {
        blocks.push({ key: FrontmatterBlocks.unquote(keyMatch[1] ?? ''), inlineValue: (keyMatch[2] ?? '').trim(), lines: [line] });
        continue;
      }
      const current = blocks.at(-1);
      if (current === undefined) {
        preambleLines.push(line);
      } else {
        current.lines.push(line);
      }
    }
    return { preambleLines, blocks };
  }

  /** True for `key:` with no value at all (Obsidian "tag property" flags). */
  static isEmptyValue(block: FrontmatterBlock): boolean {
    return block.inlineValue === '' && block.lines.slice(1).every(line => FrontmatterBlocks.isBlankOrComment(line));
  }

  /** True when the block holds a block sequence (`- item` lines). */
  static isBlockSequence(block: FrontmatterBlock): boolean {
    return block.inlineValue === '' && block.lines.slice(1).some(line => SEQUENCE_ITEM_RE.test(line));
  }

  /** True for an inline flow list value: `key: [a, b]`. */
  static isFlowList(block: FrontmatterBlock): boolean {
    return block.inlineValue.startsWith('[') && block.inlineValue.endsWith(']');
  }

  /**
   * The block's value as a list of strings: flow list, block sequence, or a
   * scalar split on commas (Obsidian accepts `tags: a, b` / `aliases: x`).
   */
  static listValues(block: FrontmatterBlock): string[] {
    let rawItems: string[];
    if (FrontmatterBlocks.isFlowList(block)) {
      rawItems = block.inlineValue.slice(1, -1).split(',');
    } else if (block.inlineValue !== '') {
      const scalar = FrontmatterBlocks.unquote(block.inlineValue);
      rawItems = scalar === block.inlineValue ? scalar.split(',') : [scalar];
    } else {
      rawItems = block.lines.slice(1).flatMap((line) => {
        const itemMatch = SEQUENCE_ITEM_RE.exec(line);
        return itemMatch === null ? [] : [itemMatch[1] ?? ''];
      });
    }
    return rawItems
      .map(item => FrontmatterBlocks.unquote(item.trim()))
      .filter(item => item !== '');
  }

  /** A scalar value without YAML quotes (`"a"` / `'a'`); as-is otherwise. */
  static unquote(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return typeof parsed === 'string' ? parsed : trimmed.slice(1, -1);
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    return trimmed;
  }

  /**
   * The value written as YAML: plain when safe, else double-quoted (JSON
   * string syntax is valid YAML). WHAT the plain charset allows: letters,
   * digits, `_`, and — not leading — space, `.`, `/`, `-`.
   */
  static yamlScalar(value: string): string {
    return /^[\p{L}\p{N}_][\p{L}\p{N}_ ./-]*$/u.test(value) && !value.endsWith(' ')
      ? value
      : JSON.stringify(value);
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static trimmed(line: string | undefined): string {
    return (line ?? '').trimEnd();
  }

  private static isBlankOrComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('#');
  }
}
