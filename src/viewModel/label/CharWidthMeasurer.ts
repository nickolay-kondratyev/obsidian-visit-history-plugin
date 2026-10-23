/**
 * Real rendered width (on-screen px) of ONE character in a label's font.
 *
 * Per-character (not per-string) on purpose: the line fitter sums widths over
 * many prefixes per tile, and a per-char cache stays bounded by the distinct
 * characters in the vault's names. Kerning is ignored — labels use the
 * monospace font, where it is nil.
 */
export interface CharWidthMeasurer {
  charWidth(char: string): number;
}

/** Memoizes a raw per-character measurement (e.g. canvas `measureText`). */
export class CachingCharWidthMeasurer implements CharWidthMeasurer {
  // CEILING: unbounded, but keyed by distinct characters only (thousands at
  // most, even for CJK-heavy vaults) — no eviction needed.
  private readonly widths = new Map<string, number>();

  constructor(private readonly measureRaw: (char: string) => number) {}

  charWidth(char: string): number {
    const cached = this.widths.get(char);
    if (cached !== undefined) return cached;
    const width = this.measureRaw(char);
    this.widths.set(char, width);
    return width;
  }
}
