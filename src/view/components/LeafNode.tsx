import { useMemo, type MouseEvent } from 'react';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { leafFieldAgo, leafFill, leafOpacity } from '../utils';
import { TileLabelText } from './TileLabelText';
import type { TileLabelLayout } from '../../viewModel/label/TileLabelLayout';
import type { ColorMode, GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';

interface LeafNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
  hovered: boolean;
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  hotDays: number;
  coldDays: number;
  onMouseMove: (e: MouseEvent) => void;
  onMouseLeave: () => void;
  /** Current zoom scale — labels fit the tile's ON-SCREEN size. */
  zoomScale: number;
  /** `undefined` until the label fonts are measured (first layout pass). */
  labelLayout: TileLabelLayout | undefined;
  /** Pre-wired by TreemapViz to open the file via IFileOpener. */
  onClick?: () => void;
}

/**
 * Pure SVG leaf rect — color-coded by type or heatmap.
 * Hover state owned by parent (TreemapViz).
 * No internal state.
 */
export function LeafNode({
  d,
  hovered,
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  onMouseMove,
  onMouseLeave,
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
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
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
        className={hovered ? 'leaf-node__bg--hovered' : undefined}
      />
      {labels && (
        <TileLabelText labels={labels} zoomScale={zoomScale} cornerClassName="leaf-node__field-ago" />
      )}
    </svg>
  );
}
