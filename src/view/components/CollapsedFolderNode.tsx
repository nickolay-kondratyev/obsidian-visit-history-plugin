import { useMemo } from 'react';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { fmtFileCount, leafFill, leafOpacity } from '../utils';
import { TileLabelText } from './TileLabelText';
import type { TileLabelLayout } from '../../viewModel/label/TileLabelLayout';
import type { ColorMode, GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';
import type { CollapsedFolder } from '../../viewModel/partitionTreemapNodes';

interface CollapsedFolderNodeProps {
  folder: CollapsedFolder;
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  hotDays: number;
  coldDays: number;
  /** Current zoom scale — labels fit the tile's ON-SCREEN size. */
  zoomScale: number;
  /** `undefined` until the label fonts are measured (first layout pass). */
  labelLayout: TileLabelLayout | undefined;
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
  zoomScale,
  labelLayout,
  onClick,
}: CollapsedFolderNodeProps) {
  const { node: d, fileCount, representative } = folder;
  const w = Math.max(0, d.x1 - d.x0);
  const h = Math.max(0, d.y1 - d.y0);
  const fill = leafFill(representative, false, colorMode, gradKey, field, hotDays, coldDays);
  const opacity = leafOpacity(representative, colorMode, field);
  const countLabel = fmtFileCount(fileCount);
  const title = d.data.name.toUpperCase();
  const labels = useMemo(
    () => labelLayout?.collapsedFolderLabels({ width: w, height: h }, zoomScale, title, countLabel),
    [labelLayout, w, h, zoomScale, title, countLabel],
  );

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
      {labels && (
        <TileLabelText labels={labels} zoomScale={zoomScale} cornerClassName="collapsed-folder-node__count" />
      )}
    </svg>
  );
}
