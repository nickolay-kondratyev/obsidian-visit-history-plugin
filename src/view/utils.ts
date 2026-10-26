import { color as d3Color } from 'd3-color';
import type { HierarchyNode } from 'd3-hierarchy';
import type { ColorMode, GradientKey, HeatField } from './constants';
import type { VaultNode } from '../core/data/VaultNode';
import { typeScale, type TileSizing } from '../viewModel/tileSize';
import { LeafColorRule } from '../viewModel/LeafColorRule';

// ── Color helpers ──────────────────────────────────────────────────────────

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

/**
 * Returns the fill color for a leaf given a timestamp and heatmap thresholds.
 * Delegates to {@link LeafColorRule.heatColor} (the color rule's single owner).
 */
export function heatColor(
  ts: number | null | undefined,
  gradKey: GradientKey,
  hotDays: number,
  coldDays: number,
): string {
  return LeafColorRule.heatColor(ts, gradKey, hotDays, coldDays, Date.now());
}

/**
 * Resolves the fill color for a leaf depending on active color mode. The base
 * color is {@link LeafColorRule}'s; only the hover brightening lives here.
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
  const base = LeafColorRule.baseColor(d.data, { colorMode, gradKey, field, hotDays, coldDays }, Date.now());
  if (!hovered) return base.fill;
  if (colorMode === 'heatmap') {
    return base.hasData ? d3Color(base.fill)!.brighter(0.45).formatHex() : base.fill;
  }
  return LeafColorRule.typeColors(d.data.type).hover;
}

/**
 * Opacity is reduced for no-data cells (see {@link LeafColorRule.hasData}) to
 * visually signal "no data". Pure function — no React, no DOM.
 */
export function leafOpacity(
  d: HierarchyNode<VaultNode>,
  colorMode: ColorMode,
  field: HeatField,
): number {
  if (colorMode === 'heatmap') {
    return LeafColorRule.hasData(d.data, colorMode, field) ? 0.88 : 0.55;
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

/**
 * Compact total-duration label: `<1s` / `45s` / `12m` / `3h 05m` (floored;
 * hours never roll up into days). null when there is no time at all.
 */
export function fmtDuration(ms: number): string | null {
  if (!(ms > 0)) return null;
  if (ms < MS_PER_SECOND) return '<1s';
  if (ms < MS_PER_MINUTE) return `${Math.floor(ms / MS_PER_SECOND)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m`;
  const hours = Math.floor(ms / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

const CURVE_LABELS: Record<TileSizing['curve'], string> = { linear: '', sqrt: 'sqrt', log: 'log' };

/**
 * How a leaf's tile size is computed under the active sizing, for the
 * tooltip — e.g. `sqrt(12.3 KB) ×0.30`, `log(3h 05m) ×1.00`, `12.3 KB ×1.00`.
 * Shows the human-readable RAW input (real bytes / focus time), not the
 * internal size unit (floored bytes / seconds).
 */
export function fmtTileSize(leaf: VaultNode, sizing: TileSizing): string {
  const raw = sizing.sizeBy === 'contentSize'
    ? fmtBytes(leaf.size ?? 0)
    : (fmtDuration(leaf.totalFocusMs ?? 0) ?? '0s');
  const curve = CURVE_LABELS[sizing.curve];
  const curved = curve === '' ? raw : `${curve}(${raw})`;
  return `${curved} ×${typeScale(leaf, sizing).toFixed(2)}`;
}

/** File-count label for a collapsed folder tile: `1 file` / `12 files`. */
export function fmtFileCount(n: number): string {
  return n === 1 ? '1 file' : `${n} files`;
}

/**
 * Builds the display path string from a D3 hierarchy node's ancestors.
 */
export function nodePath(d: HierarchyNode<VaultNode>): string {
  return d.ancestors().reverse().slice(1).map(a => a.data.name).join(' / ');
}
