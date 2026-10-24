import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { FileDetails } from './FileDetails';
import type { VaultNode } from '../../core/data/VaultNode';
import type { TileSizing } from '../../viewModel/tileSize';

// ── Props ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  x: number;
  y: number;
  node: HierarchyRectangularNode<VaultNode>;
  sizing: TileSizing;
}

// ── Tooltip component ───────────────────────────────────────────────────────

/** Hover tooltip (mouse-like pointers only) — positioned by TreemapViz inside #viz. */
export function Tooltip({ x, y, node, sizing }: TooltipProps) {
  return (
    <div id="tooltip" style={{ left: x + 'px', top: y + 'px' }}>
      <FileDetails node={node} sizing={sizing} />
    </div>
  );
}
