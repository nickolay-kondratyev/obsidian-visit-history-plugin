import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { Zoom } from '@visx/zoom';
import type { ProvidedZoom } from '@visx/zoom/lib/types';
import { FolderNode } from './FolderNode';
import { LeafNode } from './LeafNode';
import { Tooltip } from './Tooltip';
import { fmtBytes } from '../utils';
import type { GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';
import { pruneArchiveFolders } from '../../viewModel/pruneArchiveFolders';

// ── Props ───────────────────────────────────────────────────────────────────

interface TreemapVizProps {
  /** Full vault tree — always available, used as fallback when currentRoot is null. */
  data: VaultNode;
  /**
   * Subtree to show as the treemap root.
   * null = show full vault. Non-null = drilled into a specific folder.
   */
  currentRoot: VaultNode | null;
  colorMode: 'type' | 'heatmap';
  gradKey: GradientKey;
  field: HeatField;
  hotDays: number;
  coldDays: number;
  scales: Record<string, number>;
  onStatsChange: (stats: { files: number; folders: number; size: string }) => void;
  /** Called when the user clicks a folder to drill into its subtree. */
  onFolderClick: (folder: VaultNode) => void;
  fileOpener: IFileOpener;
}

// ── Zoom limits ─────────────────────────────────────────────────────────────
// At scale 1 the treemap exactly fills the container, so zooming out below 1
// only shrinks the map into empty space — cap zoom-out at the fitted view.
const ZOOM_SCALE_MIN = 1;
const ZOOM_SCALE_MAX = 30;

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
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  scales,
  onStatsChange,
  onFolderClick,
  fileOpener,
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
  // an archive (file-explorer context menu) is the way to see its contents.
  const treeRoot = useMemo(
    () => pruneArchiveFolders(currentRoot ?? data),
    [data, currentRoot],
  );

  const { folders, leaves } = useMemo(() => {
    const { w, h } = dims;
    if (!w || !h) return { folders: [], leaves: [] };

    const root = hierarchy(treeRoot)
      .sum(d => (d.children ? 0 : Math.max(1, Math.round((d.size ?? 0) * (scales[d.type ?? ''] ?? 1)))))
      .sort((a, b) => b.value! - a.value!);

    treemap<VaultNode>()
      .tile(treemapSquarify)
      .size([w, h])
      .paddingOuter(8)
      .paddingTop(d => (d.depth === 0 ? 0 : d.depth === 1 ? 20 : 16))
      .paddingInner(2)
      .round(true)(root);

    return {
      folders: root.descendants().filter(
        d => d.depth > 0 && d.children,
      ) as HierarchyRectangularNode<VaultNode>[],
      leaves: root.leaves() as HierarchyRectangularNode<VaultNode>[],
    };
  }, [treeRoot, scales, dims]);

  // ── Bubble stats up to Header ─────────────────────────────────────────

  useEffect(() => {
    onStatsChange({
      files: leaves.length,
      folders: folders.length,
      size: fmtBytes(leaves.reduce((s, d) => s + (d.data.size ?? 0), 0)),
    });
  }, [leaves, folders, onStatsChange]);

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
        {(zoom: ProvidedZoom<SVGSVGElement> & { isDragging: boolean }) => {
          // Capture zoom instance for the reset button (outside render prop).
          zoomRef.current = zoom;

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
                <FolderNode key={'f' + i} d={d} onClick={onFolderClick} />
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
        <Tooltip x={tooltip.x} y={tooltip.y} node={tooltip.node} scales={scales} />
      )}
      <div id="hint">
        scroll · zoom &nbsp;|&nbsp; drag · pan &nbsp;|&nbsp; dbl-click · reset
      </div>
      <button
        className="zoom-reset"
        onClick={() => zoomRef.current?.reset()}
      >
        reset zoom
      </button>
    </div>
  );
}
