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

export const GRADIENTS: Record<string, GradientDef> = {
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
};

// ── Field labels ───────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  lastModifiedAt: 'modified',
  createdAt: 'created',
  lastVisitedAt: 'visited',
};
