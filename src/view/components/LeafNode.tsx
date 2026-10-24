import { useMemo, type MouseEvent, type PointerEvent } from 'react';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { leafFieldAgo, leafFill, leafOpacity } from '../utils';
import { TileLabelText } from './TileLabelText';
import type { TileLabelLayout } from '../../viewModel/label/TileLabelLayout';
import type { ColorMode, GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';

interface LeafNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
  hovered: boolean;
  /** Selected by a touch tap (its details card is open). */
  selected: boolean;
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  hotDays: number;
  coldDays: number;
  /** Pointer (not mouse) events: touch taps must not trigger the hover path via compat mouse events. */
  onPointerMove: (e: PointerEvent) => void;
  onPointerLeave: () => void;
  /** Current zoom scale — labels fit the tile's ON-SCREEN size. */
  zoomScale: number;
  /** `undefined` until the label fonts are measured (first layout pass). */
  labelLayout: TileLabelLayout | undefined;
  /** Pre-wired by TreemapViz to apply the tap rules (open / select) for this file. */
  onClick?: () => void;
}

function leafBgClassName(hovered: boolean, selected: boolean): string | undefined {
  const classes = [hovered && 'leaf-node__bg--hovered', selected && 'leaf-node__bg--selected'].filter(Boolean);
  return classes.length > 0 ? classes.join(' ') : undefined;
}

/**
 * Pure SVG leaf rect — color-coded by type or heatmap.
 * Hover state owned by parent (TreemapViz).
 * No internal state.
 */
export function LeafNode({
  d,
  hovered,
  selected,
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  onPointerMove,
  onPointerLeave,
  zoomScale,
  labelLayout,
  onClick,
}: LeafNodeProps) {
  const lw = Math.max(0, d.x1 - d.x0);
  const lh = Math.max(0, d.y1 - d.y0);
  const fill = leafFill(d, hovered, colorMode, gradKey, field, hotDays, coldDays);
  const opacity = hovered ? 1 : leafOpacity(d, colorMode, field);
  // Follows the active heat field even in type color mode — the field setting
  // stays meaningful there; the tooltip still shows all three stamps.
  const fieldAgo = leafFieldAgo(d.data, field, Date.now());
  const name = d.data.name;
  // Memoized so pan frames and hover re-renders skip re-fitting; only a zoom
  // change (new on-screen size) re-fits.
  const labels = useMemo(
    () => labelLayout?.leafLabels({ width: lw, height: lh }, zoomScale, name, fieldAgo),
    [labelLayout, lw, lh, zoomScale, name, fieldAgo],
  );

  return (
    <svg
      x={d.x0}
      y={d.y0}
      width={lw}
      height={lh}
      overflow="hidden"
      // Identifies the file's tile for e2e specs (labels can be truncated or hidden).
      data-path={d.data.path}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick ? (e: MouseEvent) => {
        // Handled here — the canvas-level click means "empty space".
        e.stopPropagation();
        onClick();
      } : undefined}
      style={{ cursor: 'pointer' }}
    >
      {/* Hover stroke + label styling live in styles.css (theme-aware);
          fill/opacity stay inline — computed per node from data. */}
      <rect
        width={lw}
        height={lh}
        rx={2}
        fill={fill}
        fillOpacity={opacity}
        className={leafBgClassName(hovered, selected)}
      />
      {labels && (
        <TileLabelText labels={labels} zoomScale={zoomScale} cornerClassName="leaf-node__field-ago" />
      )}
    </svg>
  );
}
