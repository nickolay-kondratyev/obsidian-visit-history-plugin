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

// ── Tile sizing ──────────────────────────────────────────────────────────────

/**
 * What a treemap tile's area is derived from:
 * - `contentSize`: the file's size in bytes.
 * - `visitTime`: the file's total focus time (closed sessions, all users/devices).
 */
export const SIZE_BY_MODES = ['contentSize', 'visitTime'] as const;
export type SizeBy = (typeof SIZE_BY_MODES)[number];

/**
 * How the raw size (bytes / focus seconds) maps to tile area, BEFORE the
 * per-type scale: linear = proportional, sqrt = softens big outliers,
 * log = nearly equal.
 */
export const SIZE_CURVES = ['linear', 'sqrt', 'log'] as const;
export type SizeCurve = (typeof SIZE_CURVES)[number];

/** One sizing mode's settings — each mode persists its own, independently. */
export interface SizeModeConfig {
  curve: SizeCurve;
  /** Per-file-type cell area multipliers (applied AFTER the curve), keyed by TYPE_C keys (md/canvas/…). */
  scales: Record<string, BoundedValue>;
}

export interface HeatmapConfig {
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  /** Files newer than this many days get the full "hot" color. */
  hotDays: BoundedValue;
  /** Files older than this many days get the full "cold" color. */
  coldDays: BoundedValue;
  /** Active tile sizing mode. */
  sizeBy: SizeBy;
  /** Curve + scales per sizing mode; switching modes never touches the other's values. */
  sizing: Record<SizeBy, SizeModeConfig>;
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
  sizeBy: 'contentSize',
  sizing: {
    contentSize: {
      curve: 'sqrt',
      // Canvas/excalidraw are down-weighted so prose dominates the treemap.
      scales: {
        md: { value: 1, min: 0.05, max: 2 },
        canvas: { value: 0.3, min: 0.05, max: 2 },
        excalidraw: { value: 0.2, min: 0.05, max: 2 },
      },
    },
    visitTime: {
      curve: 'sqrt',
      // Time spent is comparable across types — no down-weighting.
      scales: {
        md: { value: 1, min: 0.05, max: 2 },
        canvas: { value: 1, min: 0.05, max: 2 },
        excalidraw: { value: 1, min: 0.05, max: 2 },
      },
    },
  },
  filterTerms: [],
};

// ── Boundary validation ──────────────────────────────────────────────────────

/** Keys of older persisted shapes that are still READ on upgrade (never written). */
type LegacyHeatmapConfigKey = 'scales';

/**
 * Boundary validation for the persisted heatmap config: data.json is
 * user-editable, so every field can be missing or corrupt. Invalid fields
 * fall back to their default; a valid-but-out-of-bounds slider value is
 * clamped into its bounds instead of discarded.
 */
export class HeatmapConfigSanitizer {
  static sanitize(raw: unknown): HeatmapConfig {
    const r = (raw ?? {}) as Partial<Record<keyof HeatmapConfig | LegacyHeatmapConfigKey, unknown>>;
    const d = DEFAULT_HEATMAP_CONFIG;
    const config: HeatmapConfig = {
      colorMode: HeatmapConfigSanitizer.oneOf(r.colorMode, COLOR_MODES, d.colorMode),
      gradKey: HeatmapConfigSanitizer.oneOf(r.gradKey, GRADIENT_KEYS, d.gradKey),
      field: HeatmapConfigSanitizer.oneOf(r.field, HEAT_FIELDS, d.field),
      hotDays: HeatmapConfigSanitizer.sanitizeBounded(r.hotDays, d.hotDays, DAYS_HARD_MIN),
      coldDays: HeatmapConfigSanitizer.sanitizeBounded(r.coldDays, d.coldDays, DAYS_HARD_MIN),
      sizeBy: HeatmapConfigSanitizer.oneOf(r.sizeBy, SIZE_BY_MODES, d.sizeBy),
      sizing: HeatmapConfigSanitizer.sanitizeSizing(r.sizing, r.scales),
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

  private static sanitizeSizing(
    raw: unknown,
    legacyScales: unknown,
  ): Record<SizeBy, SizeModeConfig> {
    const rawSizing = HeatmapConfigSanitizer.asRecord(raw);
    const rawContent = rawSizing['contentSize'];
    // LEGACY read (cleanup after 2027-April): before per-mode sizing, the
    // content scales lived in a top-level `scales` key. Fall back to it while
    // the new per-mode entry is absent so upgrading users keep their sliders.
    const legacyContent = HeatmapConfigSanitizer.isObject(rawContent)
      ? rawContent
      : { scales: legacyScales };
    return {
      contentSize: HeatmapConfigSanitizer.sanitizeSizeMode(legacyContent, 'contentSize'),
      visitTime: HeatmapConfigSanitizer.sanitizeSizeMode(rawSizing['visitTime'], 'visitTime'),
    };
  }

  /** A missing/unknown curve falls back to the mode's default (`sqrt`). */
  private static sanitizeSizeMode(raw: unknown, mode: SizeBy): SizeModeConfig {
    const r = HeatmapConfigSanitizer.asRecord(raw);
    const fallback = DEFAULT_HEATMAP_CONFIG.sizing[mode];
    return {
      curve: HeatmapConfigSanitizer.oneOf(r['curve'], SIZE_CURVES, fallback.curve),
      scales: HeatmapConfigSanitizer.sanitizeScales(r['scales'], fallback.scales),
    };
  }

  /** Exactly the default scale keys survive — unknown extra keys are dropped. */
  private static sanitizeScales(
    raw: unknown,
    defaults: Record<string, BoundedValue>,
  ): Record<string, BoundedValue> {
    const r = HeatmapConfigSanitizer.asRecord(raw);
    const scales: Record<string, BoundedValue> = {};
    for (const [type, fallback] of Object.entries(defaults)) {
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

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static asRecord(value: unknown): Record<string, unknown> {
    return HeatmapConfigSanitizer.isObject(value) ? value : {};
  }

  private static isFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
