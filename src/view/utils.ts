import { color as d3Color } from 'd3-color';
import type { HierarchyNode } from 'd3-hierarchy';
import { interpolateRgb } from 'd3-interpolate';
import { GRADIENTS, TYPE_C, type ColorMode, type GradientKey, type HeatField } from './constants';
import type { VaultNode } from '../core/data/VaultNode';

// ── Color helpers ──────────────────────────────────────────────────────────

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

/**
 * Returns the fill color for a leaf given a timestamp and heatmap thresholds.
 * Pure function — no React, no DOM.
 */
export function heatColor(
  ts: number | null | undefined,
  gradKey: GradientKey,
  hotDays: number,
  coldDays: number,
): string {
  const g = GRADIENTS[gradKey];
  if (ts == null) return g.nil;

  const daysOld = (Date.now() - ts) / MS_PER_DAY;
  if (daysOld <= hotDays) return g.hot;
  if (daysOld >= coldDays) return g.cold;

  return interpolateRgb(g.hot, g.cold)((daysOld - hotDays) / (coldDays - hotDays));
}

/**
 * Resolves the fill color for a leaf depending on active color mode.
 * Pure function — no React, no DOM.
 */
export function leafFill(
  d: HierarchyNode<VaultNode>,
  hovered: boolean,
  colorMode: ColorMode,
  gradKey: GradientKey,
  field: HeatField,
  hotDays: number,
  coldDays: number,
): string {
  if (colorMode === 'heatmap') {
    const ts = d.data[field];
    const base = heatColor(ts, gradKey, hotDays, coldDays);
    return hovered && ts != null
      ? d3Color(base)!.brighter(0.45).formatHex()
      : base;
  }

  const c = TYPE_C[d.data.type ?? ''] ?? { fill: '#555', hover: '#777' };
  return hovered ? c.hover : c.fill;
}

/**
 * Opacity is reduced for null-timestamp cells to visually signal "no data".
 * Pure function — no React, no DOM.
 */
export function leafOpacity(
  d: HierarchyNode<VaultNode>,
  colorMode: ColorMode,
  field: HeatField,
): number {
  if (colorMode === 'heatmap') {
    const ts = d.data[field];
    return ts == null ? 0.55 : 0.88;
  }
  return 0.78;
}

// ── Formatting helpers ─────────────────────────────────────────────────────

export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

export function fmtDate(ts: number | null | undefined): string | null {
  if (ts == null) return null;
  const d = Math.round((Date.now() - ts) / MS_PER_DAY);
  let rel: string;
  if (d === 0) rel = 'today';
  else if (d === 1) rel = 'yesterday';
  else rel = `${d}d ago`;
  return `${new Date(ts).toISOString().slice(0, 10)} (${rel})`;
}

/**
 * Compact age of `ts` relative to `nowMs` for the in-tile corner label:
 * `<1m ago` / `33m ago` / `12h ago` / `3d ago` (floored to the largest whole
 * unit; days never roll up further). Future stamps (clock skew between synced
 * devices) clamp to `<1m ago`.
 */
export function fmtAgo(ts: number, nowMs: number): string {
  const ageMs = Math.max(0, nowMs - ts);
  if (ageMs >= MS_PER_DAY) return `${Math.floor(ageMs / MS_PER_DAY)}d ago`;
  if (ageMs >= MS_PER_HOUR) return `${Math.floor(ageMs / MS_PER_HOUR)}h ago`;
  if (ageMs >= MS_PER_MINUTE) return `${Math.floor(ageMs / MS_PER_MINUTE)}m ago`;
  return '<1m ago';
}

/**
 * In-tile corner label: age of the leaf's stamp for the ACTIVE heat `field`
 * (created / modified / visited), so the label always matches what the
 * timestamp-field setting is about. `undefined` when that stamp is missing.
 */
export function leafFieldAgo(leaf: VaultNode, field: HeatField, nowMs: number): string | undefined {
  const ts = leaf[field];
  return ts == null ? undefined : fmtAgo(ts, nowMs);
}

/** File-count label for a collapsed folder tile: `1 file` / `12 files`. */
export function fmtFileCount(n: number): string {
  return n === 1 ? '1 file' : `${n} files`;
}

// ── Leaf label layout ──────────────────────────────────────────────────────
// Tile-local geometry (pre-zoom units) for the 9px monospace leaf labels
// (`.leaf-node__label` in styles.css). Char width is an ESTIMATE (monospace
// ≈ 0.6em) — no DOM text measurement, so a theme with a wider mono font may
// clip the last char; upgrade path: measure via getComputedTextLength.
export const LEAF_LABEL_PAD_PX = 3;
/** A tile shows its title only when STRICTLY larger than these. */
export const TILE_TITLE_MIN_WIDTH_PX = 32;
export const TILE_TITLE_MIN_HEIGHT_PX = 14;
const LEAF_LABEL_LINE_HEIGHT_PX = 12;
const LEAF_LABEL_CHAR_WIDTH_PX = 5.5;
/** Title line + empty spacer line + bottom line — keeps both labels unsquished. */
const CORNER_LABEL_MIN_LINES = 3;

/**
 * Whether a tile of `width`×`height` has room for `text` in its bottom-right
 * corner below the title, with a blank line in between.
 */
export function cornerLabelFits(width: number, height: number, text: string): boolean {
  const neededWidth = text.length * LEAF_LABEL_CHAR_WIDTH_PX + 2 * LEAF_LABEL_PAD_PX;
  const neededHeight = CORNER_LABEL_MIN_LINES * LEAF_LABEL_LINE_HEIGHT_PX;
  return width >= neededWidth && height >= neededHeight;
}

/**
 * Builds the display path string from a D3 hierarchy node's ancestors.
 */
export function nodePath(d: HierarchyNode<VaultNode>): string {
  return d.ancestors().reverse().slice(1).map(a => a.data.name).join(' / ');
}
