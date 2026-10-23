import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { Zoom } from '@visx/zoom';
import type { ProvidedZoom, TransformMatrix } from '@visx/zoom/lib/types';
import { FolderNode } from './FolderNode';
import { LeafNode } from './LeafNode';
import { CollapsedFolderNode } from './CollapsedFolderNode';
import { Tooltip } from './Tooltip';
import { fmtBytes } from '../utils';
import type { ColorMode, GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';
import { pruneArchiveFolders } from '../../viewModel/pruneArchiveFolders';
import { filterVaultTree, isFilterActive, type HeatmapTreeFilter } from '../../viewModel/filterVaultTree';
import { partitionTreemapNodes, type TreemapPartition } from '../../viewModel/partitionTreemapNodes';
import { hideUnvisitedFiles, tileValue, type TileSizing } from '../../viewModel/tileSize';
import { ClusteredTimestampsRule, type ClusteredTimestamps } from '../../viewModel/ClusteredTimestampsRule';
import { TileLabelLayout } from '../../viewModel/label/TileLabelLayout';
import { CanvasLabelFontProbe } from '../label/CanvasLabelFontProbe';

// ── Props ───────────────────────────────────────────────────────────────────

/** Stats of the CURRENT view (after drill-down, _archive pruning, filters, sizing). */
export interface TreemapStats {
  /** Visible files (incl. those inside collapsed folders). */
  files: number;
  folders: number;
  /** Formatted raw byte total of the visible files. */
  size: string;
  /** Files left out because they have no visit time (visit-time sizing only; else 0). */
  hiddenNoVisitCount: number;
  /** Laid-out files share (nearly) one time on the color field; undefined = no warning. */
  clusteredTimestamps: ClusteredTimestamps | undefined;
}

interface TreemapVizProps {
  /** Full vault tree — always available, used as fallback when currentRoot is null. */
  data: VaultNode;
  /**
   * Subtree to show as the treemap root.
   * null = show full vault. Non-null = drilled into a specific folder.
   */
  currentRoot: VaultNode | null;
  /**
   * True when the view root is at or under an _archive folder — _archive
   * pruning is skipped then (within an archive ALL archived content shows).
   */
  showArchived: boolean;
  /** Include-filter applied to the rendered subtree (OR across terms). */
  filter: HeatmapTreeFilter;
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  hotDays: number;
  coldDays: number;
  /** Active tile sizing (mode, curve, plain per-type factors). */
  sizing: TileSizing;
  onStatsChange: (stats: TreemapStats) => void;
  /**
   * Called when the user clicks a folder to drill into its subtree.
   * Receives the folder's path segments RELATIVE to the rendered root
   * (App appends them to its vault-relative nav path).
   */
  onFolderClick: (relativeSegments: string[]) => void;
  fileOpener: IFileOpener;
  /**
   * Hands the zoom-reset action up to the host (App wires it into the
   * header's reset button). Called once on mount with a stable function.
   */
  registerResetZoom: (reset: () => void) => void;
  /** Clears ALL filter terms — the empty state's escape hatch. */
  onClearFilters: () => void;
  /** Switches sizing to content size — the all-unvisited empty state's escape hatch. */
  onSizeByContent: () => void;
}

// ── Zoom limits ─────────────────────────────────────────────────────────────
// At scale 1 the treemap exactly fills the container, so zooming out below 1
// only shrinks the map into empty space — cap zoom-out at the fitted view.
const ZOOM_SCALE_MIN = 1;
const ZOOM_SCALE_MAX = 30;

// ── Layout result ───────────────────────────────────────────────────────────

/** Totals over the WHOLE rendered subtree — incl. files inside collapsed folders. */
interface TreemapTotals {
  files: number;
  folders: number;
  bytes: number;
}

interface TreemapLayout {
  root: HierarchyRectangularNode<VaultNode>;
  totals: TreemapTotals;
}

const EMPTY_TOTALS: TreemapTotals = { files: 0, folders: 0, bytes: 0 };
const EMPTY_PARTITION: TreemapPartition = { folders: [], collapsedFolders: [], leaves: [] };

/** One pass over the laid-out hierarchy; folder/file split mirrors the partition. */
function computeTotals(root: HierarchyRectangularNode<VaultNode>): TreemapTotals {
  const totals: TreemapTotals = { files: 0, folders: 0, bytes: 0 };
  root.each(d => {
    if (!d.data.children) {
      totals.files += 1;
      totals.bytes += d.data.size ?? 0;
    } else if (d.depth > 0 && d.children) {
      // d3 leaves `children` undefined for an EMPTY folder — not counted.
      totals.folders += 1;
    }
  });
  return totals;
}

/** File (leaf) nodes of the laid-out hierarchy — an EMPTY folder is a d3 leaf too, so filtered out. */
function laidOutFiles(root: HierarchyRectangularNode<VaultNode>): VaultNode[] {
  return root.leaves().filter(d => !d.data.children).map(d => d.data);
}

// ── Tooltip state ───────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  node: HierarchyRectangularNode<VaultNode>;
}

// ── TreemapViz component ────────────────────────────────────────────────────

/**
 * SVG treemap visualization.
 *
 * D3 boundary:
 * - d3.hierarchy + d3.treemap → useMemo (pure layout math, no DOM).
 * - Zoom/pan → @visx/zoom render-prop (transform in React state, no ref hacking).
 * - d3.interpolateRgb, d3.color → pure functions in utils.ts.
 */
export function TreemapViz({
  data,
  currentRoot,
  showArchived,
  filter,
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  sizing,
  onStatsChange,
  onFolderClick,
  fileOpener,
  registerResetZoom,
  onClearFilters,
  onSizeByContent,
}: TreemapVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Capture the @visx/zoom instance from the render prop for the reset button.
  const zoomRef = useRef<ProvidedZoom<SVGSVGElement> | null>(null);
  // Store last-measured tooltip DOM dimensions for accurate edge-flip decisions.
  // Initial fallback: 230×140 (reasonable estimate before first measurement).
  const tooltipSizeRef = useRef<{ width: number; height: number }>({ width: 230, height: 140 });

  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [labelLayout, setLabelLayout] = useState<TileLabelLayout | undefined>(undefined);

  // ── Label fonts — measured once from the rendered CSS ──────────────────

  // Layout effect: fonts are read before first paint, so labels appear
  // without a flash of label-less tiles.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const fonts = CanvasLabelFontProbe.readLabelFonts(svg);
    if (fonts) setLabelLayout(new TileLabelLayout(fonts));
  }, []);

  // ── Expose zoom reset to the host (header button lives outside #viz) ────

  useEffect(() => {
    // Closure over the stable zoomRef — survives Zoom render-prop re-renders.
    registerResetZoom(() => zoomRef.current?.reset());
  }, [registerResetZoom]);

  // ── ResizeObserver — track container size ──────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver(entries => {
      const r = entries[0]!.contentRect;
      setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Measure tooltip DOM after paint to keep edge-flip accurate ────────

  useEffect(() => {
    if (!tooltip) return;
    // rAF ensures the DOM has painted before we measure. window-prefixed for
    // Obsidian popout-window compatibility.
    const raf = window.requestAnimationFrame(() => {
      // Query scoped to our own container (not the global document) — works
      // in popout windows and cannot collide with other views' elements.
      const el = containerRef.current?.querySelector('#tooltip');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          tooltipSizeRef.current = { width: r.width, height: r.height };
        }
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [tooltip?.node]); // only re-measure when content (node) changes, not on every pixel move

  // ── D3 treemap layout — pure math in useMemo ──────────────────────────

  // _archive folders below the view root are hidden; scoping the view INTO
  // an archive (file-explorer context menu) is the way to see its contents —
  // and within one, nothing is pruned (showArchived).
  const { sizeBy } = sizing;
  const { tree: treeRoot, hiddenCount: hiddenNoVisitCount } = useMemo(() => {
    const root = currentRoot ?? data;
    // Filter composes AFTER archive pruning, hiding of zero-size (unvisited)
    // files AFTER the filter — all pure tree copies; the stats/legend
    // automatically reflect the result (they derive from layout), and the
    // hidden count covers exactly the files the user would otherwise see.
    const filtered = filterVaultTree(showArchived ? root : pruneArchiveFolders(root), filter);
    return hideUnvisitedFiles(filtered, sizeBy);
  }, [data, currentRoot, showArchived, filter, sizeBy]);

  const layout = useMemo((): TreemapLayout | null => {
    const { w, h } = dims;
    if (!w || !h) return null;

    const root = hierarchy(treeRoot)
      .sum(d => (d.children ? 0 : tileValue(d, sizing)))
      .sort((a, b) => b.value! - a.value!);

    const laidOut = treemap<VaultNode>()
      .tile(treemapSquarify)
      .size([w, h])
      .paddingOuter(8)
      .paddingTop(d => {
        if (d.depth === 0) return 0;
        if (d.depth === 1) return 20;
        return 16;
      })
      .paddingInner(2)
      .round(true)(root);

    return { root: laidOut, totals: computeTotals(laidOut) };
  }, [treeRoot, sizing, dims]);

  const totals = layout?.totals ?? EMPTY_TOTALS;

  // Separate memo from the layout: switching the heat field only re-picks
  // collapsed folders' representatives — no re-layout.
  const { folders, collapsedFolders, leaves } = useMemo(
    () => (layout ? partitionTreemapNodes(layout.root, field) : EMPTY_PARTITION),
    [layout, field],
  );

  // Laid-out files = what the user sees (after prune/filter/visit-time hiding),
  // incl. those inside collapsed folders. O(n log n) — fine per field change.
  const clusteredTimestamps = useMemo(
    () => (layout ? ClusteredTimestampsRule.evaluate(laidOutFiles(layout.root), field, colorMode) : undefined),
    [layout, field, colorMode],
  );

  // ── Bubble stats up to Header ─────────────────────────────────────────

  // From totals, NOT the rendered partition — files inside collapsed folders
  // still count.
  useEffect(() => {
    onStatsChange({
      files: totals.files,
      folders: totals.folders,
      size: fmtBytes(totals.bytes),
      hiddenNoVisitCount,
      clusteredTimestamps,
    });
  }, [totals, hiddenNoVisitCount, clusteredTimestamps, onStatsChange]);

  // Mutually exclusive empty states: "nothing visited" wins — clearing filters
  // would not help when the remaining files simply have no visit time.
  const allHiddenByVisitTime = totals.files === 0 && hiddenNoVisitCount > 0;
  const noFilterMatch = !allHiddenByVisitTime && isFilterActive(filter) && totals.files === 0;

  // ── Hover / tooltip handlers ──────────────────────────────────────────
  //
  // The tooltip is position:absolute inside #viz (which itself is
  // position:absolute).  We compute coordinates relative to the #viz
  // container so that ancestor CSS transforms (common in Obsidian's
  // workspace layout) cannot shift the containing block away from the
  // viewport — a known failure mode of position:fixed.
  //
  // We read actual tooltip dimensions from the DOM (via tooltipSizeRef)
  // so edge-flip decisions are accurate even with variable-width content.
  // Default placement: right + below the cursor (8 px gap).
  // Flips left when near the right edge, flips above when near the bottom,
  // and clamps to the viz container bounds to prevent off-screen overflow.

  const TOOLTIP_GAP = 8;

  const handleLeafMove = useCallback(
    (e: MouseEvent, d: HierarchyRectangularNode<VaultNode>, i: number) => {
      if (hoveredIdx !== i) setHoveredIdx(i);
      const vizRect = containerRef.current?.getBoundingClientRect();
      if (!vizRect) {
        setTooltip({ x: e.clientX + TOOLTIP_GAP, y: e.clientY + TOOLTIP_GAP, node: d });
        return;
      }
      const { width: tw, height: th } = tooltipSizeRef.current;

      // Cursor position relative to #viz container
      const rx = e.clientX - vizRect.left;
      const ry = e.clientY - vizRect.top;

      // Default: right of cursor, below cursor
      let tx = rx + TOOLTIP_GAP;
      let ty = ry + TOOLTIP_GAP;

      // Flip horizontally if tooltip would overflow the right edge of #viz
      if (tx + tw > vizRect.width) {
        tx = rx - tw - TOOLTIP_GAP;
      }
      // Clamp if flipped position would overflow the left edge
      if (tx < 0) {
        tx = 4;
      }

      // Flip vertically if tooltip would overflow the bottom edge of #viz
      if (ty + th > vizRect.height) {
        ty = ry - th - TOOLTIP_GAP;
      }
      // Clamp if flipped position would overflow the top edge
      if (ty < 0) {
        ty = 4;
      }

      setTooltip({ x: tx, y: ty, node: d });
    },
    [hoveredIdx],
  );

  const handleLeafLeave = useCallback(() => {
    setHoveredIdx(null);
    setTooltip(null);
  }, []);

  const handleFolderNodeClick = useCallback(
    (d: HierarchyRectangularNode<VaultNode>) => {
      // ancestors() walks up to the hierarchy root — which is the RENDERED
      // root — so slice(1) yields root-RELATIVE segments (folder names never
      // contain '/', they come from splitting vault paths on '/').
      onFolderClick(d.ancestors().reverse().slice(1).map(a => a.data.name));
    },
    [onFolderClick],
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div id="viz" ref={containerRef}>
      <Zoom
        width={dims.w}
        height={dims.h}
        scaleXMin={ZOOM_SCALE_MIN}
        scaleXMax={ZOOM_SCALE_MAX}
        scaleYMin={ZOOM_SCALE_MIN}
        scaleYMax={ZOOM_SCALE_MAX}
      >
        {(zoom: ProvidedZoom<SVGSVGElement> & { isDragging: boolean; transformMatrix: TransformMatrix }) => {
          // Capture zoom instance for the reset button (outside render prop).
          zoomRef.current = zoom;
          // Uniform zoom (scaleX/Y share limits and wheel steps) → scaleX is THE scale.
          const zoomScale = zoom.transformMatrix.scaleX;

          return (
          <svg
            ref={(el: SVGSVGElement | null) => {
              svgRef.current = el;
              (zoom.containerRef as RefObject<SVGSVGElement | null>).current = el;
            }}
            width={dims.w}
            height={dims.h}
            className={zoom.isDragging ? 'drag' : ''}
          >
            <g transform={zoom.toString()}>
              {folders.map((d, i) => (
                <FolderNode
                  key={'f' + i}
                  d={d}
                  onClick={handleFolderNodeClick}
                  zoomScale={zoomScale}
                  labelLayout={labelLayout}
                />
              ))}
              {collapsedFolders.map((c, i) => (
                <CollapsedFolderNode
                  key={'c' + i}
                  folder={c}
                  colorMode={colorMode}
                  gradKey={gradKey}
                  field={field}
                  hotDays={hotDays}
                  coldDays={coldDays}
                  zoomScale={zoomScale}
                  labelLayout={labelLayout}
                  onClick={handleFolderNodeClick}
                />
              ))}
              {leaves.map((d, i) => (
                <LeafNode
                  key={'l' + i}
                  d={d}
                  hovered={hoveredIdx === i}
                  colorMode={colorMode}
                  gradKey={gradKey}
                  field={field}
                  hotDays={hotDays}
                  coldDays={coldDays}
                  onMouseMove={e => handleLeafMove(e, d, i)}
                  onMouseLeave={handleLeafLeave}
                  zoomScale={zoomScale}
                  labelLayout={labelLayout}
                  onClick={
                    d.data.path
                      ? () => fileOpener.openFile(d.data.path!)
                      : undefined
                  }
                />
              ))}
            </g>
          </svg>
          );
        }}
      </Zoom>
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} node={tooltip.node} sizing={sizing} />
      )}
      {allHiddenByVisitTime && (
        <div className="viz-empty">
          <div className="viz-empty-msg">None of these notes have visit history yet</div>
          <button
            type="button"
            className="header-btn"
            onClick={onSizeByContent}
            title="Size tiles by file content size instead of visit time"
          >
            size by content
          </button>
        </div>
      )}
      {noFilterMatch && (
        <div className="viz-empty">
          <div className="viz-empty-msg">No files match the current filters</div>
          <button
            type="button"
            className="header-btn"
            onClick={onClearFilters}
            title="Remove all filter terms"
          >
            clear filters
          </button>
        </div>
      )}
      <div id="hint">
        scroll · zoom &nbsp;|&nbsp; drag · pan &nbsp;|&nbsp; dbl-click · reset
      </div>
    </div>
  );
}
