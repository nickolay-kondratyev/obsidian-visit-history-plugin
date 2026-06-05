import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { interpolateRgb } from 'd3-interpolate';
import type { VaultNode } from '../../core/data/VaultNode';

interface FolderNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
}

/**
 * Pure SVG folder rect — depth-based fill, optional label.
 * No state, no event handlers.
 */
export function FolderNode({ d }: FolderNodeProps) {
  const w = Math.max(0, d.x1 - d.x0);
  const h = Math.max(0, d.y1 - d.y0);

  return (
    <svg
      x={d.x0}
      y={d.y0}
      width={w}
      height={h}
      overflow="hidden"
    >
      <rect
        width={w}
        height={h}
        fill={interpolateRgb('#0c0c0f', '#28283a')(d.depth * 0.18)}
        stroke={d.depth === 1 ? '#2e2e3e' : '#222230'}
        strokeWidth={d.depth === 1 ? 1.5 : 0.75}
      />
      {h > 14 && (
        <text
          x={5}
          y={d.depth === 1 ? 14 : 12}
          fontFamily="var(--font-monospace)"
          fontSize={d.depth === 1 ? 10 : 9}
          fontWeight={d.depth === 1 ? 500 : 400}
          letterSpacing="0.1em"
          fill="#505062"
        >
          {d.data.name.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
