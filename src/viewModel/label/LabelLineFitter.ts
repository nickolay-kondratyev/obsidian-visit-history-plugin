import type { CharWidthMeasurer } from './CharWidthMeasurer';

/** Marks a name cut short on its last visible line. */
export const LABEL_ELLIPSIS = '…';

// Characters a line may break on either side of: CJK ideographs/kana/hangul and
// full-width forms (U+1100–115F Hangul Jamo, U+2E80–A4CF CJK radicals → Yi,
// U+AC00–D7A3 Hangul syllables, U+F900–FAFF compat ideographs, U+FE30–FE4F CJK
// compat forms, U+FF00–FF60 / U+FFE0–FFE6 full-width forms, planes 2–3 ideographs).
const BREAK_ANYWHERE_CHAR =
  /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3FFFD}]/u;
/** A line may break AFTER these (file-name word separators). */
const BREAK_AFTER_CHARS: ReadonlySet<string> = new Set(['-', '_', '.']);
const WHITESPACE = /\s/;
/** Absorbs float noise when summed char widths land exactly on the limit. */
const WIDTH_EPSILON_PX = 1e-6;

/**
 * Breaks a label into lines that each fit a width, by MEASURED character widths
 * (pure — the measurer is injected, so this stays DOM-free).
 *
 * Greedy: each line takes as much as fits, breaking at the last opportunity —
 * whitespace, after `-` `_` `.`, or next to any CJK character. A single token
 * longer than a line breaks between any two characters. When the name still
 * doesn't fit in `maxLines`, the last line ends with "…".
 * WHY-NOT hyphenation / language-aware word breaking: out of scope (ticket
 * nid_qv6dvik5peosopm9ewks3rkm8_e) — file names are mostly short tokens.
 */
export class LabelLineFitter {
  constructor(private readonly measurer: CharWidthMeasurer) {}

  /**
   * Lines to draw for `text` within `maxWidthPx`, at most `maxLines` of them.
   * Empty when nothing useful fits: no lines allowed, or the name doesn't fit
   * whole and even its first character + "…" is too wide.
   */
  fitLines(text: string, maxWidthPx: number, maxLines: number): string[] {
    const chars = Array.from(text.trim());
    if (chars.length === 0 || maxLines < 1) return [];
    const line = new MeasuredChars(chars, this.measurer);
    const limit = maxWidthPx + WIDTH_EPSILON_PX;
    const ellipsisWidth = this.measurer.charWidth(LABEL_ELLIPSIS);
    if (line.width(0, chars.length) <= limit) return [chars.join('')];
    if (line.width(0, 1) + ellipsisWidth > limit) return [];

    const lines: string[] = [];
    let start = 0;
    while (start < chars.length) {
      start = line.skipWhitespace(start);
      if (start >= chars.length) break;
      const end = line.fitEnd(start, limit);
      if (end === chars.length) {
        lines.push(line.text(start, end));
        break;
      }
      // Last allowed line, or not even one char of this line fits → cut it here.
      if (lines.length === maxLines - 1 || end === start) {
        lines.push(line.text(start, line.fitEnd(start, limit - ellipsisWidth)) + LABEL_ELLIPSIS);
        break;
      }
      const breakAt = line.lastBreakIn(start, end) ?? end;
      lines.push(line.text(start, breakAt));
      start = breakAt;
    }
    return lines;
  }
}

/** One label's characters with prefix-summed widths — O(1) width of any slice. */
class MeasuredChars {
  /** prefixWidths[i] = width of chars[0, i). */
  private readonly prefixWidths: number[];

  constructor(
    private readonly chars: readonly string[],
    measurer: CharWidthMeasurer,
  ) {
    this.prefixWidths = [0];
    let sum = 0;
    for (const ch of chars) {
      sum += measurer.charWidth(ch);
      this.prefixWidths.push(sum);
    }
  }

  width(start: number, end: number): number {
    return this.at(end) - this.at(start);
  }

  /** Largest `end` (≥ start) such that chars[start, end) fits `limit`. */
  fitEnd(start: number, limit: number): number {
    let end = start;
    while (end < this.chars.length && this.width(start, end + 1) <= limit) end++;
    return end;
  }

  /** Last position in (start, end] where a line may break, if any. */
  lastBreakIn(start: number, end: number): number | undefined {
    for (let k = end; k > start; k--) {
      if (this.canBreakBefore(k)) return k;
    }
    return undefined;
  }

  skipWhitespace(start: number): number {
    let i = start;
    while (i < this.chars.length && WHITESPACE.test(this.charAt(i))) i++;
    return i;
  }

  /** chars[start, end) without trailing whitespace. */
  text(start: number, end: number): string {
    return this.chars.slice(start, end).join('').trimEnd();
  }

  private canBreakBefore(k: number): boolean {
    const prev = this.charAt(k - 1);
    const next = this.charAt(k);
    return (
      WHITESPACE.test(prev) ||
      WHITESPACE.test(next) ||
      BREAK_AFTER_CHARS.has(prev) ||
      BREAK_ANYWHERE_CHAR.test(prev) ||
      BREAK_ANYWHERE_CHAR.test(next)
    );
  }

  private charAt(i: number): string {
    return this.chars[i] ?? '';
  }

  private at(i: number): number {
    return this.prefixWidths[i] ?? 0;
  }
}
