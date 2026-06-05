import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { Zoom } from '@visx/zoom';
import type { ProvidedZoom } from '@visx/zoom/lib/types';
import { FolderNode } from './FolderNode';
import { LeafNode } from './LeafNode';
import { Tooltip } from './Tooltip';
import { fmtBytes } from '../utils';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';

// ── Props ───────────────────────────────────────────────────────────────────

interface TreemapVizProps {
  data: VaultNode;
  colorMode: 'type' | 'heatmap';
  gradKey: string;
  field: string;
  hotDays: number;
  coldDays: number;
  scales: Record<string, number>;
  onStatsChange: (stats: { files: number; folders: number; size: string }) => void;
  fileOpener: IFileOpener;
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
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  scales,
  onStatsChange,
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
    // rAF ensures the DOM has painted before we measure.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById('tooltip');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          tooltipSizeRef.current = { width: r.width, height: r.height };
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [tooltip?.node]); // only re-measure when content (node) changes, not on every pixel move

  // ── D3 treemap layout — pure math in useMemo ──────────────────────────

  const { folders, leaves } = useMemo(() => {
    const { w, h } = dims;
    if (!w || !h) return { folders: [], leaves: [] };

    const root = hierarchy(data)
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
  }, [data, scales, dims]);

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
    (e: React.MouseEvent, d: HierarchyRectangularNode<VaultNode>, i: number) => {
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
        scaleXMin={0.05}
        scaleXMax={30}
        scaleYMin={0.05}
        scaleYMax={30}
      >
        {(zoom: ProvidedZoom<SVGSVGElement> & { isDragging: boolean }) => {
          // Capture zoom instance for the reset button (outside render prop).
          zoomRef.current = zoom;

          return (
          <svg
            ref={(el: SVGSVGElement | null) => {
              svgRef.current = el;
              (zoom.containerRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
            }}
            width={dims.w}
            height={dims.h}
            className={zoom.isDragging ? 'drag' : ''}
          >
            <g transform={zoom.toString()}>
              {folders.map((d, i) => (
                <FolderNode key={'f' + i} d={d} />
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
