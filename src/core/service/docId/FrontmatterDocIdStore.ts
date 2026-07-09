import { TFile } from 'obsidian';
import { DocIdStore } from './DocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';

// Leading YAML frontmatter block: '---' on the first line up to the closing '---'.
const FRONTMATTER_BLOCK_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
// Degenerate empty block ('---' directly followed by the closing '---') —
// FRONTMATTER_BLOCK_REGEX requires a body line, so it misses this shape.
const EMPTY_FRONTMATTER_BLOCK_REGEX = /^---\r?\n---(?:\r?\n|$)/;
// Top-level (unindented) id entry — plain or quoted key — carrying a value.
// [ \t] (not \s) on purpose: \s crosses newlines and would swallow the next
// line of a nested mapping as the "value".
const FRONTMATTER_ID_LINE_REGEX = /^(?:id|"id"|'id')[ \t]*:[ \t]*(.+)$/m;
// Top-level id entry with NO value on its line (YAML null, or a nested
// mapping whose entries follow on indented lines).
const FRONTMATTER_VALUELESS_ID_LINE_REGEX = /^(?:id|"id"|'id')[ \t]*:[ \t]*$/m;
// Opening frontmatter delimiter line.
const FRONTMATTER_OPENING_REGEX = /^---\r?\n/;

/** Outcome of one raw-content write attempt. */
interface WriteOutcome {
  content: string;
  id: string | null;
}

/**
 * Doc id store for markdown-family notes (.md, incl. .excalidraw.md):
 * the id lives in the YAML frontmatter under the 'id' key.
 *
 * WHY raw-text editing (not FileManager.processFrontMatter): Obsidian
 * re-serializes the WHOLE frontmatter block on write, normalizing formatting
 * of keys we do not own (e.g. stripping quotes from `"some key": v`). We only
 * ever add or fill the single id line and leave every other byte untouched.
 * Writes stay atomic via Vault.process (same pattern as CanvasDocIdStore).
 */
export class FrontmatterDocIdStore implements DocIdStore {
  constructor(
    private readonly noteFileUtil: NoteFileUtil,
    private readonly docIdGenerator: DocIdGenerator,
  ) {
  }

  async ensureId(file: TFile): Promise<string | null> {
    // Fast path: an existing id means NO write at all (no mtime churn).
    const existingId = this.readIdFromRawContent(await this.noteFileUtil.cachedRead(file));
    if (existingId !== null) {
      return existingId;
    }

    const newId = this.docIdGenerator.generate();
    let resultId: string | null = null;
    await this.noteFileUtil.process(file, (content) => {
      const outcome = this.writeIdIntoContent(content, newId);
      resultId = outcome.id;
      return outcome.content;
    });
    return resultId;
  }

  /** Extracts a top-level frontmatter `id` value from raw note text, or null. */
  private readIdFromRawContent(content: string): string | null {
    const block = FRONTMATTER_BLOCK_REGEX.exec(content);
    if (!block?.[1]) {
      return null;
    }
    const idLine = FRONTMATTER_ID_LINE_REGEX.exec(block[1]);
    if (!idLine?.[1]) {
      return null;
    }
    const value = this.parseYamlScalar(idLine[1].trim());
    return value.length > 0 ? value : null;
  }

  // ── private: raw-content id insertion ───────────────────────────────────────

  private writeIdIntoContent(content: string, newId: string): WriteOutcome {
    // Re-check inside the atomic read-modify-write: the content may have
    // changed since the precheck read (and may have gained an id).
    const existingId = this.readIdFromRawContent(content);
    if (existingId !== null) {
      return { content, id: existingId };
    }

    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const block = FRONTMATTER_BLOCK_REGEX.exec(content);
    if (block?.[1] !== undefined) {
      return this.writeIdIntoBlock(content, block[1], newId, eol);
    }
    if (EMPTY_FRONTMATTER_BLOCK_REGEX.test(content)) {
      return { content: this.insertIdLineAfterOpening(content, newId, eol), id: newId };
    }
    // No (valid) frontmatter block → create one. A leading '---' without a
    // closing delimiter is a thematic break, not frontmatter — prepending
    // keeps it rendering as one below the new block.
    return { content: `---${eol}id: ${newId}${eol}---${eol}${content}`, id: newId };
  }

  private writeIdIntoBlock(content: string, blockBody: string, newId: string, eol: string): WriteOutcome {
    const valuelessIdLine = FRONTMATTER_VALUELESS_ID_LINE_REGEX.exec(blockBody);
    if (valuelessIdLine) {
      if (this.isFollowedByIndentedLine(blockBody, valuelessIdLine)) {
        // `id:` opens a nested mapping — an occupied (unusable) slot that
        // must never be overwritten.
        return { content, id: null };
      }
      // `id:` with an empty (null) value → fill it in place. Matching on the
      // full content is safe: every line before this one failed the same
      // regex, so the first match in content IS the block's line.
      return {
        content: content.replace(FRONTMATTER_VALUELESS_ID_LINE_REGEX, `id: ${newId}`),
        id: newId,
      };
    }
    // No id key in the block → insert it as the first entry.
    return { content: this.insertIdLineAfterOpening(content, newId, eol), id: newId };
  }

  /** True when the matched line is followed by an indented continuation line. */
  private isFollowedByIndentedLine(blockBody: string, match: RegExpExecArray): boolean {
    const rest = blockBody.slice(match.index + match[0].length).replace(/^\r?\n/, '');
    const nextLine = rest.split(/\r?\n/, 1)[0] ?? '';
    return /^[ \t]/.test(nextLine);
  }

  /** Inserts the id line directly after the opening '---' delimiter line. */
  private insertIdLineAfterOpening(content: string, newId: string, eol: string): string {
    return content.replace(FRONTMATTER_OPENING_REGEX, `---${eol}id: ${newId}${eol}`);
  }

  /**
   * Minimal YAML scalar handling for the fast path:
   * - quoted value → content of the first "..." / '...' token
   * - unquoted value → everything before a ` #` comment (YAML requires
   *   whitespace before '#', so `a#b` stays intact)
   */
  private parseYamlScalar(raw: string): string {
    // Backreference \1 closes with the same quote that opened.
    const quoted = /^(["'])((?:(?!\1).)*)\1/.exec(raw);
    if (quoted?.[2] !== undefined) {
      return quoted[2];
    }
    return raw.replace(/\s#.*$/, '').trim();
  }
}
