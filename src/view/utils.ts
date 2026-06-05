import { color as d3Color } from 'd3-color';
import type { HierarchyNode } from 'd3-hierarchy';
import { interpolateRgb } from 'd3-interpolate';
import { GRADIENTS, TYPE_C } from './constants';
import type { VaultNode } from '../core/data/VaultNode';

// ── Color helpers ──────────────────────────────────────────────────────────

/**
 * Returns the fill color for a leaf given a timestamp and heatmap thresholds.
 * Pure function — no React, no DOM.
 */
export function heatColor(
  ts: number | null | undefined,
  gradKey: string,
  hotDays: number,
  coldDays: number,
): string {
  const g = GRADIENTS[gradKey]!;
  if (ts == null) return g.nil;

  const daysOld = (Date.now() - ts) / 86400000;
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
  colorMode: 'type' | 'heatmap',
  gradKey: string,
  field: string,
  hotDays: number,
  coldDays: number,
): string {
  if (colorMode === 'heatmap') {
    const ts = d.data[field as keyof VaultNode] as number | null | undefined;
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
  colorMode: 'type' | 'heatmap',
  field: string,
): number {
  if (colorMode === 'heatmap') {
    const ts = d.data[field as keyof VaultNode];
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
  const d = Math.round((Date.now() - ts) / 86400000);
  const rel = d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
  return `${new Date(ts).toISOString().slice(0, 10)} (${rel})`;
}

/**
 * Builds the display path string from a D3 hierarchy node's ancestors.
 */
export function nodePath(d: HierarchyNode<VaultNode>): string {
  return d.ancestors().reverse().slice(1).map(a => a.data.name).join(' / ');
}
