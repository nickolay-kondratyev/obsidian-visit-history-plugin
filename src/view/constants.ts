// ── File-type color mapping ────────────────────────────────────────────────
// Colors for each supported file extension category.
// No Obsidian theme equivalent — plugin-specific custom properties.

export interface TypeColors {
  fill: string;
  hover: string;
  badge: string;
  fg: string;
}

export const TYPE_C: Record<string, TypeColors> = {
  md: {
    fill: '#4a5ed4',
    hover: '#6070e8',
    badge: '#3248b0',
    fg: '#a0b0ff',
  },
  canvas: {
    fill: '#be7220',
    hover: '#d48832',
    badge: '#9a5a10',
    fg: '#f0c070',
  },
  excalidraw: {
    fill: '#1e9e8e',
    hover: '#2cb4a2',
    badge: '#14786c',
    fg: '#70d4c8',
  },
};

// ── Heatmap gradients ──────────────────────────────────────────────────────
// hot  = color applied to newest files (≤ hotDays old)
// cold = color applied to oldest files (≥ coldDays old)
// nil  = color for null/missing timestamp ("no data")

export interface GradientDef {
  label: string;
  sub: string;
  hot: string;
  cold: string;
  nil: string;
}

export const GRADIENTS = {
  nature: {
    label: 'Nature',
    sub: 'green → blue',
    hot: '#1db954',
    cold: '#1a3a7a',
    nil: '#1a1a20',
  },
  ember: {
    label: 'Ember',
    sub: 'red → ice',
    hot: '#e84020',
    cold: '#0a1e58',
    nil: '#111118',
  },
  mono: {
    label: 'Mono',
    sub: 'white → black',
    hot: '#d8d8d8',
    cold: '#1c1c1c',
    nil: '#6d28d9',
  },
} satisfies Record<string, GradientDef>;

export type GradientKey = keyof typeof GRADIENTS;

// Object.keys() returns string[] by TS design — this cast is the single,
// well-understood boundary for iterating a literal-keyed record.
export const GRADIENT_KEYS = Object.keys(GRADIENTS) as GradientKey[];

// ── Color modes ────────────────────────────────────────────────────────────
// How treemap cells are colored: by file type, or by timestamp heatmap.

export const COLOR_MODES = ['type', 'heatmap'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

// ── Heatmap timestamp fields ───────────────────────────────────────────────
// The VaultNode timestamp fields the heatmap can color by.

export const HEAT_FIELDS = ['createdAt', 'lastModifiedAt', 'lastVisitedAt'] as const;
export type HeatField = (typeof HEAT_FIELDS)[number];

export const FIELD_LABELS: Record<HeatField, string> = {
  lastModifiedAt: 'modified',
  createdAt: 'created',
  lastVisitedAt: 'visited',
};

/** Secondary description per field, shown in the config panel's radio rows. */
export const FIELD_SUBS: Record<HeatField, string> = {
  lastModifiedAt: 'file modified time',
  createdAt: 'file created time',
  lastVisitedAt: 'your visit history',
};
