// import type (not value): heatmapConfig imports this module at runtime
// (sanitizer delegates to FilterTermOps.add) — a value import back would
// create a runtime cycle.
import type { FilterTerm, FilterTermKind } from './heatmapConfig';

/**
 * Reserved separator for encoding a term-text list into ONE string (e.g.
 * App.tsx's content-terms effect-dependency key). {@link FilterTermOps.add}
 * rejects texts containing it, so a joined key always splits back losslessly.
 */
export const FILTER_TERM_KEY_SEP = '\u0000';

/**
 * Pure edits/queries of the heatmap's {@link FilterTerm} list.
 *
 * {@link add} is the SINGLE normalization point (trim + case-insensitive
 * per-kind dedupe + {@link FILTER_TERM_KEY_SEP} ban) — both UI adds and
 * {@link import('./heatmapConfig').HeatmapConfigSanitizer}'s data.json
 * boundary go through it, so a term list is canonical wherever it came from.
 */
export class FilterTermOps {
  /**
   * Appends a trimmed term. Returns the ORIGINAL array (same reference) when
   * the trimmed text is empty, contains {@link FILTER_TERM_KEY_SEP}, or is a
   * case-insensitive duplicate of an existing same-kind term — callers can
   * use reference equality to detect the no-op.
   */
  static add(terms: FilterTerm[], kind: FilterTermKind, rawText: string): FilterTerm[] {
    const text = rawText.trim();
    if (text.length === 0 || text.includes(FILTER_TERM_KEY_SEP)) return terms;
    const lowered = text.toLowerCase();
    if (terms.some(t => t.kind === kind && t.text.toLowerCase() === lowered)) return terms;
    return [...terms, { kind, text }];
  }

  /** Removes the term matching (kind, text) exactly. */
  static remove(terms: FilterTerm[], term: FilterTerm): FilterTerm[] {
    return terms.filter(t => !(t.kind === term.kind && t.text === term.text));
  }

  /** Texts of all terms of the given kind, in list order. */
  static textsOfKind(terms: FilterTerm[], kind: FilterTermKind): string[] {
    return terms.filter(t => t.kind === kind).map(t => t.text);
  }
}
