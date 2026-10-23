import { useMemo } from 'react';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import type { VaultNode } from '../../core/data/VaultNode';
import type { TileLabelLayout } from '../../viewModel/label/TileLabelLayout';

interface FolderNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
  /**
   * Called when the user clicks the folder rect. Receives the HIERARCHY node
   * (not just the VaultNode) so the caller can derive the folder's position
   * relative to the rendered root via d.ancestors().
   */
  onClick?: (d: HierarchyRectangularNode<VaultNode>) => void;
  /** Current zoom scale — the label fits the rect's ON-SCREEN size. */
  zoomScale: number;
  /** `undefined` until the label fonts are measured (first layout pass). */
  labelLayout: TileLabelLayout | undefined;
}

/** Deepest depth tier with its own CSS fill — deeper folders reuse it. */
const MAX_DEPTH_TIER = 4;

/**
 * Clickable SVG folder rect — depth-based fill, optional label.
 *
 * All colors live in styles.css (folder-node__* classes) and derive from
 * Obsidian theme vars, so the canvas follows light/dark themes. Depth is
 * quantized into tiers d1..d4 for the CSS fill scale.
 *
 * Folders with children are interactive: clicking drills into that folder's subtree.
 * Hover provides visual feedback (accent-tinted fill, pointer cursor, title).
 */
export function FolderNode({ d, onClick, zoomScale, labelLayout }: FolderNodeProps) {
  const w = Math.max(0, d.x1 - d.x0);
  const h = Math.max(0, d.y1 - d.y0);
  const hasChildren = d.children && d.children.length > 0;
  const interactive = hasChildren && !!onClick;
  const depthTier = Math.min(d.depth, MAX_DEPTH_TIER);
  const title = d.data.name.toUpperCase();
  const label = useMemo(
    () => labelLayout?.folderLabel({ width: w, height: h }, zoomScale, title, d.depth),
    [labelLayout, w, h, zoomScale, title, d.depth],
  );

  return (
    <svg
      x={d.x0}
      y={d.y0}
      width={w}
      height={h}
      overflow="hidden"
      className={interactive ? 'folder-node--interactive' : undefined}
      style={interactive ? { cursor: 'pointer' } : undefined}
      onClick={interactive ? () => onClick(d) : undefined}
    >
      {/* SVG-native hover tooltip — the leaf tooltip does not cover folders. */}
      {interactive && <title>{`${d.data.name} — click to drill in`}</title>}
      <rect
        width={w}
        height={h}
        className={`folder-node__bg folder-node__bg--d${depthTier}`}
      />
      {label && (
        // scale(1 / zoom): constant on-screen text size (see TileLabelText).
        <g transform={`scale(${1 / zoomScale})`}>
          <text
            x={label.xPx}
            y={label.baselinePx}
            className={'folder-node__label' + (d.depth === 1 ? ' folder-node__label--top' : '')}
          >
            {label.text}
          </text>
        </g>
      )}
    </svg>
  );
}
