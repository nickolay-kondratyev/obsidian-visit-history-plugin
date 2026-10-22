import type { MouseEvent } from 'react';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import {
  cornerLabelFits,
  fmtAgo,
  LEAF_LABEL_PAD_PX,
  leafFill,
  leafOpacity,
  TILE_TITLE_MIN_HEIGHT_PX,
  TILE_TITLE_MIN_WIDTH_PX,
} from '../utils';
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
  onClick,
}: LeafNodeProps) {
  const lw = Math.max(0, d.x1 - d.x0);
  const lh = Math.max(0, d.y1 - d.y0);
  const fill = leafFill(d, hovered, colorMode, gradKey, field, hotDays, coldDays);
  const opacity = hovered ? 1 : leafOpacity(d, colorMode, field);
  // Always LAST VISIT (not the active heat field) — the ticket's ask; the
  // tooltip still shows all three stamps.
  const visitedAt = d.data.lastVisitedAt;
  const visitAgo = visitedAt == null ? undefined : fmtAgo(visitedAt, Date.now());

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
      {lw > TILE_TITLE_MIN_WIDTH_PX && lh > TILE_TITLE_MIN_HEIGHT_PX && (
        <text x={LEAF_LABEL_PAD_PX} y={11} className="leaf-node__label">
          {d.data.name}
        </text>
      )}
      {visitAgo !== undefined && cornerLabelFits(lw, lh, visitAgo) && (
        <text
          x={lw - LEAF_LABEL_PAD_PX}
          y={lh - LEAF_LABEL_PAD_PX}
          textAnchor="end"
          className="leaf-node__label leaf-node__visit-ago"
        >
          {visitAgo}
        </text>
      )}
    </svg>
  );
}
