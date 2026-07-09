import type { MouseEvent } from 'react';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { leafFill, leafOpacity } from '../utils';
import type { GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';

interface LeafNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
  hovered: boolean;
  colorMode: 'type' | 'heatmap';
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
      <rect
        width={lw}
        height={lh}
        rx={2}
        fill={fill}
        fillOpacity={opacity}
        stroke={hovered ? 'rgba(255,255,255,0.4)' : 'none'}
        strokeWidth={1}
      />
      {lw > 32 && lh > 14 && (
        <text
          x={3}
          y={11}
          fontFamily="var(--font-monospace)"
          fontSize={9}
          fill="rgba(255,255,255,0.65)"
        >
          {d.data.name}
        </text>
      )}
    </svg>
  );
}
