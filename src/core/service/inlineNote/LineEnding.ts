/** A note's line break style. */
export type Eol = '\n' | '\r\n';

const LF = '\n';
const CRLF = '\r\n';
const TRAILING_CR_RE = /\r$/;

/**
 * Line endings of inline-note edits: parsing works on CR-free lines and the
 * receiving note is written back with ITS line ending, so inserted lines
 * never mix LF into a CRLF note (or CR into an LF one).
 * Ceiling: a note that already mixes both is normalized to the style of its
 * first line break.
 */
export class LineEnding {
  /** The style of the first line break; LF when there is none. */
  static detect(content: string): Eol {
    const firstLf = content.indexOf(LF);
    return firstLf > 0 && content[firstLf - 1] === '\r' ? CRLF : LF;
  }

  /** Lines split on LF, each without a trailing CR. */
  static splitLines(content: string): string[] {
    return content.split(LF).map(line => LineEnding.withoutCr(line));
  }

  /** Lines joined with `eol`; a stray trailing CR on any line is dropped first. */
  static joinLines(lines: readonly string[], eol: Eol): string {
    return lines.map(line => LineEnding.withoutCr(line)).join(eol);
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static withoutCr(line: string): string {
    return line.replace(TRAILING_CR_RE, '');
  }
}
