import {
  COLOR_MODES,
  GRADIENT_KEYS,
  HEAT_FIELDS,
  type ColorMode,
  type GradientKey,
  type HeatField,
} from '../view/constants';
import { FilterTermOps } from './FilterTermOps';

// ── Heatmap config model ─────────────────────────────────────────────────────
// The full state of the heatmap config panel. Persisted in the plugin's
// data.json (settings.heatmap) so it sticks across Obsidian restarts.

/**
 * A slider value together with its USER-EDITABLE slider bounds.
 * Invariants (enforced by {@link HeatmapConfigSanitizer} and the UI):
 * `min < max` and `min <= value <= max`.
 */
export interface BoundedValue {
  value: number;
  min: number;
  max: number;
}

// ── Filter terms ─────────────────────────────────────────────────────────────

export const FILTER_TERM_KINDS = ['path', 'content'] as const;
export type FilterTermKind = (typeof FILTER_TERM_KINDS)[number];

/**
 * One include-filter term for the heatmap. Terms combine with OR semantics:
 * a file is shown when it matches ANY term (include-only, no exclusions).
 * - `path`: case-insensitive substring of the file's FULL vault path.
 * - `content`: case-insensitive substring of the file's content.
 */
export interface FilterTerm {
  kind: FilterTermKind;
  text: string;
}

export interface HeatmapConfig {
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  /** Files newer than this many days get the full "hot" color. */
  hotDays: BoundedValue;
  /** Files older than this many days get the full "cold" color. */
  coldDays: BoundedValue;
  /** Per-file-type cell area multipliers, keyed by TYPE_C keys (md/canvas/…). */
  scales: Record<string, BoundedValue>;
  /** Include-filter terms (OR across all). Empty = no filtering. */
  filterTerms: FilterTerm[];
}

/** Absolute floor for a scale slider's min bound — 0 would zero cell areas. */
export const SCALE_HARD_MIN = 0.01;
/** Absolute floor for a day-threshold slider's min bound. */
export const DAYS_HARD_MIN = 1;

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
  colorMode: 'heatmap',
  gradKey: 'nature',
  field: 'lastModifiedAt',
  hotDays: { value: 3, min: 1, max: 15 },
  coldDays: { value: 21, min: 7, max: 60 },
  // Canvas/excalidraw are down-weighted so prose dominates the treemap.
  scales: {
    md: { value: 1, min: 0.05, max: 2 },
    canvas: { value: 0.3, min: 0.05, max: 2 },
    excalidraw: { value: 0.2, min: 0.05, max: 2 },
  },
  filterTerms: [],
};

// ── Boundary validation ──────────────────────────────────────────────────────

/**
 * Boundary validation for the persisted heatmap config: data.json is
 * user-editable, so every field can be missing or corrupt. Invalid fields
 * fall back to their default; a valid-but-out-of-bounds slider value is
 * clamped into its bounds instead of discarded.
 */
export class HeatmapConfigSanitizer {
  static sanitize(raw: unknown): HeatmapConfig {
    const r = (raw ?? {}) as Partial<Record<keyof HeatmapConfig, unknown>>;
    const d = DEFAULT_HEATMAP_CONFIG;
    const config: HeatmapConfig = {
      colorMode: HeatmapConfigSanitizer.oneOf(r.colorMode, COLOR_MODES, d.colorMode),
      gradKey: HeatmapConfigSanitizer.oneOf(r.gradKey, GRADIENT_KEYS, d.gradKey),
      field: HeatmapConfigSanitizer.oneOf(r.field, HEAT_FIELDS, d.field),
      hotDays: HeatmapConfigSanitizer.sanitizeBounded(r.hotDays, d.hotDays, DAYS_HARD_MIN),
      coldDays: HeatmapConfigSanitizer.sanitizeBounded(r.coldDays, d.coldDays, DAYS_HARD_MIN),
      scales: HeatmapConfigSanitizer.sanitizeScales(r.scales),
      filterTerms: HeatmapConfigSanitizer.sanitizeFilterTerms(r.filterTerms),
    };
    // Cross-invariant: hot must stay strictly below cold or the gradient
    // interpolation range collapses. Reset both rather than guessing intent.
    if (config.hotDays.value >= config.coldDays.value) {
      config.hotDays = { ...d.hotDays };
      config.coldDays = { ...d.coldDays };
    }
    return config;
  }

  private static oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.find(a => a === value) ?? fallback;
  }

  private static sanitizeBounded(
    raw: unknown,
    fallback: BoundedValue,
    hardMin: number,
  ): BoundedValue {
    const r = (raw ?? {}) as Partial<Record<keyof BoundedValue, unknown>>;
    let min = HeatmapConfigSanitizer.isFinite(r.min) && r.min >= hardMin ? r.min : fallback.min;
    let max = HeatmapConfigSanitizer.isFinite(r.max) ? r.max : fallback.max;
    if (max <= min) {
      min = fallback.min;
      max = fallback.max;
    }
    const value = HeatmapConfigSanitizer.isFinite(r.value) ? r.value : fallback.value;
    return { min, max, value: Math.min(Math.max(value, min), max) };
  }

  /** Exactly the default scale keys survive — unknown extra keys are dropped. */
  private static sanitizeScales(raw: unknown): Record<string, BoundedValue> {
    const r = (raw ?? {}) as Record<string, unknown>;
    const scales: Record<string, BoundedValue> = {};
    for (const [type, fallback] of Object.entries(DEFAULT_HEATMAP_CONFIG.scales)) {
      scales[type] = HeatmapConfigSanitizer.sanitizeBounded(r[type], fallback, SCALE_HARD_MIN);
    }
    return scales;
  }

  /**
   * Keeps only shape-valid entries (known kind + string text) and folds them
   * through {@link FilterTermOps.add} — the single owner of the normalization
   * rule (trim, non-empty, per-kind ci-dedupe first-wins, key-separator ban).
   * Everything malformed is dropped silently (per-field fallback style).
   */
  private static sanitizeFilterTerms(raw: unknown): FilterTerm[] {
    if (!Array.isArray(raw)) return [];
    let terms: FilterTerm[] = [];
    for (const item of raw) {
      const r = (item ?? {}) as Partial<Record<keyof FilterTerm, unknown>>;
      const kind = FILTER_TERM_KINDS.find(k => k === r.kind);
      if (kind === undefined || typeof r.text !== 'string') continue;
      terms = FilterTermOps.add(terms, kind, r.text);
    }
    return terms;
  }

  private static isFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
