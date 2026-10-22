import type { HierarchyRectangularNode } from 'd3-hierarchy';
import {
  cornerLabelFits,
  fmtFileCount,
  LEAF_LABEL_PAD_PX,
  leafFill,
  leafOpacity,
  TILE_TITLE_MIN_HEIGHT_PX,
  TILE_TITLE_MIN_WIDTH_PX,
} from '../utils';
import type { ColorMode, GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';
import type { CollapsedFolder } from '../../viewModel/partitionTreemapNodes';

/** Title baseline — same as LeafNode's title. */
const TITLE_BASELINE_Y_PX = 11;

interface CollapsedFolderNodeProps {
  folder: CollapsedFolder;
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  hotDays: number;
  coldDays: number;
  /** Same drill-in handler as FolderNode (receives the folder's hierarchy node). */
  onClick: (d: HierarchyRectangularNode<VaultNode>) => void;
}

/**
 * A folder too dense to render file-by-file (see partitionTreemapNodes):
 * ONE tile colored like its most recent file, titled with the folder name and
 * its file count. Dashed border (styles.css) marks it as a folder, not a file;
 * clicking drills in like FolderNode. Hover feedback is CSS-only.
 */
export function CollapsedFolderNode({
  folder,
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  onClick,
}: CollapsedFolderNodeProps) {
  const { node: d, fileCount, representative } = folder;
  const w = Math.max(0, d.x1 - d.x0);
  const h = Math.max(0, d.y1 - d.y0);
  const fill = leafFill(representative, false, colorMode, gradKey, field, hotDays, coldDays);
  const opacity = leafOpacity(representative, colorMode, field);
  const countLabel = fmtFileCount(fileCount);

  return (
    <svg
      x={d.x0}
      y={d.y0}
      width={w}
      height={h}
      overflow="hidden"
      className="collapsed-folder-node"
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(d)}
    >
      <title>{`${d.data.name} — ${countLabel}, click to drill in`}</title>
      <rect
        width={w}
        height={h}
        rx={2}
        fill={fill}
        fillOpacity={opacity}
        className="collapsed-folder-node__bg"
      />
      {w > TILE_TITLE_MIN_WIDTH_PX && h > TILE_TITLE_MIN_HEIGHT_PX && (
        <text x={LEAF_LABEL_PAD_PX} y={TITLE_BASELINE_Y_PX} className="leaf-node__label">
          {d.data.name.toUpperCase()}
        </text>
      )}
      {cornerLabelFits(w, h, countLabel) && (
        <text
          x={w - LEAF_LABEL_PAD_PX}
          y={h - LEAF_LABEL_PAD_PX}
          textAnchor="end"
          className="leaf-node__label collapsed-folder-node__count"
        >
          {countLabel}
        </text>
      )}
    </svg>
  );
}
