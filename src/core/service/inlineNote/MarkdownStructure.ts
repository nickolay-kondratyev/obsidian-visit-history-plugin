/** An ATX heading (`## Text`) found outside fenced code. */
export interface MarkdownHeading {
  readonly lineIndex: number;
  readonly level: number;
  readonly text: string;
}

export const MAX_HEADING_LEVEL = 6;

// WHAT: 1-6 `#`, then whitespace + text (or nothing), optional closing `#`s.
// `#tag` (no space) is NOT a heading. Groups: 1 = hashes, 2 = text.
const HEADING_RE = /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
// WHAT: a code fence opener/closer — 3+ backticks or tildes, any indent
// (Obsidian notes indent fences inside list items). Group 1 = the fence run.
const FENCE_RE = /^\s*(`{3,}|~{3,})/;

/**
 * Line-level markdown structure: ATX headings and fenced code blocks.
 * Ceiling: setext headings (`===` underlines) are not recognized — Obsidian
 * notes rarely use them.
 */
export class MarkdownStructure {
  /** The heading on this line, or null. Does NOT know about code fences. */
  static parseHeading(line: string): { level: number; text: string } | null {
    const match = HEADING_RE.exec(line.trimEnd());
    if (match === null) {
      return null;
    }
    return { level: match[1]?.length ?? 0, text: (match[2] ?? '').trim() };
  }

  /** Per line: true when inside a fenced code block (fence lines included). */
  static codeLineFlags(lines: readonly string[]): boolean[] {
    const flags: boolean[] = [];
    let openFence: string | null = null;
    for (const line of lines) {
      const fence = FENCE_RE.exec(line)?.[1];
      if (openFence === null) {
        if (fence !== undefined) {
          openFence = fence;
        }
        flags.push(openFence !== null);
        continue;
      }
      flags.push(true);
      // Closes on the same fence char with at least the opener's length.
      if (fence !== undefined && fence[0] === openFence[0] && fence.length >= openFence.length
        && line.trim() === fence) {
        openFence = null;
      }
    }
    return flags;
  }

  /** Headings outside fenced code, from `fromLineIndex` on. */
  static headings(lines: readonly string[], fromLineIndex = 0): MarkdownHeading[] {
    const codeFlags = MarkdownStructure.codeLineFlags(lines);
    const headings: MarkdownHeading[] = [];
    for (let index = fromLineIndex; index < lines.length; index++) {
      if (codeFlags[index] === true) {
        continue;
      }
      const heading = MarkdownStructure.parseHeading(lines[index] ?? '');
      if (heading !== null) {
        headings.push({ lineIndex: index, ...heading });
      }
    }
    return headings;
  }

  /**
   * Lines with every heading (outside code) moved `delta` levels deeper.
   * Callers must check the result stays within MAX_HEADING_LEVEL.
   */
  static shiftHeadings(lines: readonly string[], delta: number): string[] {
    const shifted = [...lines];
    for (const heading of MarkdownStructure.headings(lines)) {
      const line = lines[heading.lineIndex] ?? '';
      shifted[heading.lineIndex] = '#'.repeat(heading.level + delta) + line.slice(heading.level);
    }
    return shifted;
  }

  /** Without leading and trailing blank lines. */
  static trimBlankLines(lines: readonly string[]): string[] {
    let start = 0;
    let end = lines.length;
    while (start < end && (lines[start] ?? '').trim() === '') start++;
    while (end > start && (lines[end - 1] ?? '').trim() === '') end--;
    return lines.slice(start, end);
  }
}
