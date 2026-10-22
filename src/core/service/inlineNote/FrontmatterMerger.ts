import { FrontmatterBlock, FrontmatterBlocks } from './FrontmatterBlocks';
import { FrontmatterAdditions } from './InlinedNoteParser';
import { LineEnding } from './LineEnding';

const TAGS_KEY = 'tags';
const ALIASES_KEY = 'aliases';
const FENCE = '---';
const DEFAULT_ITEM_INDENT = '  ';
const SEQUENCE_ITEM_RE = /^(\s*)-\s/;

/**
 * Adds the inlined note's tags, aliases and flag keys to the receiving
 * note's frontmatter as a RAW-TEXT edit that only adds: existing lines stay
 * byte-identical except where a value must grow (a flow list gets new items;
 * a scalar `tags: a` becomes a block list so it can hold more — Obsidian
 * accepts both forms). Never processFrontMatter (see FrontmatterBlocks).
 * Written back with the note's own line ending (LineEnding).
 */
export class FrontmatterMerger {
  static merge(content: string, additions: FrontmatterAdditions): string {
    const split = FrontmatterBlocks.split(content);
    const { preambleLines, blocks } = FrontmatterBlocks.parseBlocks(FrontmatterBlocks.frontmatterLines(split));
    const tagsBlock = blocks.find(block => block.key === TAGS_KEY);
    const aliasesBlock = blocks.find(block => block.key === ALIASES_KEY);
    const missingTags = FrontmatterMerger.missing(additions.tags, tagsBlock, tag => FrontmatterMerger.normalizeTag(tag));
    const missingAliases = FrontmatterMerger.missing(additions.aliases, aliasesBlock, alias => alias);
    const missingFlagKeys = [...new Set(additions.flagKeys)].filter(key => !blocks.some(block => block.key === key));
    if (missingTags.length === 0 && missingAliases.length === 0 && missingFlagKeys.length === 0) {
      return content;
    }

    const frontmatterLines = [
      ...preambleLines,
      ...blocks.flatMap((block) => {
        if (block === tagsBlock && missingTags.length > 0) return FrontmatterMerger.withItems(block, missingTags);
        if (block === aliasesBlock && missingAliases.length > 0) return FrontmatterMerger.withItems(block, missingAliases);
        return [...block.lines];
      }),
      ...(tagsBlock === undefined ? FrontmatterMerger.newListKey(TAGS_KEY, missingTags) : []),
      ...(aliasesBlock === undefined ? FrontmatterMerger.newListKey(ALIASES_KEY, missingAliases) : []),
      ...missingFlagKeys.map(key => `${key}:`),
    ];
    const eol = LineEnding.detect(content);
    if (split.closingFenceIndex === null) {
      return LineEnding.joinLines([FENCE, ...frontmatterLines, FENCE], eol) + eol + content;
    }
    return LineEnding.joinLines(
      [split.lines[0] ?? FENCE, ...frontmatterLines, ...split.lines.slice(split.closingFenceIndex)],
      eol,
    );
  }

  // ── private ─────────────────────────────────────────────────────────────

  /** Additions not yet present (deduplicated, compared via `normalize`). */
  private static missing(
    additions: readonly string[],
    existingBlock: FrontmatterBlock | undefined,
    normalize: (value: string) => string,
  ): string[] {
    const seen = new Set((existingBlock === undefined ? [] : FrontmatterBlocks.listValues(existingBlock)).map(normalize));
    const missing: string[] = [];
    for (const value of additions) {
      if (!seen.has(normalize(value))) {
        seen.add(normalize(value));
        missing.push(value);
      }
    }
    return missing;
  }

  /** Obsidian tags are case-insensitive and may be written with `#`. */
  private static normalizeTag(tag: string): string {
    return tag.replace(/^#/, '').toLowerCase();
  }

  private static newListKey(key: string, items: readonly string[]): string[] {
    return items.length === 0 ? [] : [`${key}:`, ...FrontmatterMerger.itemLines(DEFAULT_ITEM_INDENT, items)];
  }

  private static itemLines(indent: string, items: readonly string[]): string[] {
    return items.map(item => `${indent}- ${FrontmatterBlocks.yamlScalar(item)}`);
  }

  /** The block's lines with `items` added to its list value. */
  private static withItems(block: FrontmatterBlock, items: readonly string[]): string[] {
    const [keyLine = '', ...continuation] = block.lines;
    if (FrontmatterBlocks.isFlowList(block)) {
      const closeIndex = keyLine.lastIndexOf(']');
      const separator = block.inlineValue.slice(1, -1).trim() === '' ? '' : ', ';
      const added = items.map(item => FrontmatterBlocks.yamlScalar(item)).join(', ');
      return [keyLine.slice(0, closeIndex) + separator + added + keyLine.slice(closeIndex), ...continuation];
    }
    if (FrontmatterBlocks.isBlockSequence(block)) {
      const lastItemIndex = FrontmatterMerger.lastIndexWhere(continuation, line => SEQUENCE_ITEM_RE.test(line));
      const indent = SEQUENCE_ITEM_RE.exec(continuation[lastItemIndex] ?? '')?.[1] ?? DEFAULT_ITEM_INDENT;
      const insertAt = FrontmatterMerger.lastIndexWhere(continuation, line => line.trim() !== '') + 1;
      return [
        keyLine,
        ...continuation.slice(0, insertAt),
        ...FrontmatterMerger.itemLines(indent, items),
        ...continuation.slice(insertAt),
      ];
    }
    if (block.inlineValue === '') {
      return [keyLine, ...FrontmatterMerger.itemLines(DEFAULT_ITEM_INDENT, items), ...continuation];
    }
    // Scalar (`tags: a, b`): becomes a block list holding the old values + new ones.
    const keyPrefix = keyLine.slice(0, keyLine.lastIndexOf(block.inlineValue)).trimEnd();
    return [
      keyPrefix,
      ...FrontmatterMerger.itemLines(DEFAULT_ITEM_INDENT, [...FrontmatterBlocks.listValues(block), ...items]),
      ...continuation,
    ];
  }

  private static lastIndexWhere(lines: readonly string[], predicate: (line: string) => boolean): number {
    for (let index = lines.length - 1; index >= 0; index--) {
      if (predicate(lines[index] ?? '')) return index;
    }
    return -1;
  }
}
