import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { interpolateRgb } from 'd3-interpolate';
import type { VaultNode } from '../../core/data/VaultNode';

interface FolderNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
  /** Called when the user clicks the folder rect. Receives the VaultNode subtree. */
  onClick?: (folder: VaultNode) => void;
}

/**
 * Clickable SVG folder rect — depth-based fill, optional label.
 *
 * Folders with children are interactive: clicking drills into that folder's subtree.
 * Hover provides visual feedback (lighter fill, pointer cursor).
 */
export function FolderNode({ d, onClick }: FolderNodeProps) {
  const w = Math.max(0, d.x1 - d.x0);
  const h = Math.max(0, d.y1 - d.y0);
  const hasChildren = d.children && d.children.length > 0;
  const interactive = hasChildren && !!onClick;
  if (hasChildren) {
    console.debug('[FolderNode]', d.data.name, 'interactive:', interactive, 'hasOnClick:', !!onClick);
  }

  const depthFill = interpolateRgb('#0c0c0f', '#28283a')(d.depth * 0.18);

  return (
    <svg
      x={d.x0}
      y={d.y0}
      width={w}
      height={h}
      overflow="hidden"
      className={interactive ? 'folder-node--interactive' : undefined}
      style={interactive ? { cursor: 'pointer' } : undefined}
      onClick={interactive ? () => onClick(d.data) : undefined}
    >
      <rect
        width={w}
        height={h}
        fill={depthFill}
        stroke={d.depth === 1 ? '#2e2e3e' : '#222230'}
        strokeWidth={d.depth === 1 ? 1.5 : 0.75}
        className="folder-node__bg"
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
