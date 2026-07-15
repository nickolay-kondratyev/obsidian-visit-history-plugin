import { FilterTerm, FilterTermKind } from './heatmapConfig';

/**
 * Pure edits/queries of the heatmap's {@link FilterTerm} list.
 *
 * Add-time normalization (trim + case-insensitive per-kind dedupe) mirrors
 * {@link import('./heatmapConfig').HeatmapConfigSanitizer}'s boundary rules so
 * a term list stays canonical whether it came from the UI or from data.json.
 */
export class FilterTermOps {
  /**
   * Appends a trimmed term. Returns the ORIGINAL array (same reference) when
   * the trimmed text is empty or a case-insensitive duplicate of an existing
   * same-kind term — callers can use reference equality to detect the no-op.
   */
  static add(terms: FilterTerm[], kind: FilterTermKind, rawText: string): FilterTerm[] {
    const text = rawText.trim();
    if (text.length === 0) return terms;
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
