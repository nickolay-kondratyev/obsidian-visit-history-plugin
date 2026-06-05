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

  const handleLeafMove = useCallback(
    (e: React.MouseEvent, d: HierarchyRectangularNode<VaultNode>, i: number) => {
      if (hoveredIdx !== i) setHoveredIdx(i);
      const TW = 230,
        TH = 165,
        cx = e.clientX,
        cy = e.clientY;
      setTooltip({
        x: cx + 16 + TW > window.innerWidth ? cx - TW - 8 : cx + 16,
        y: cy - 12 + TH > window.innerHeight ? cy - TH - 4 : cy - 12,
        node: d,
      });
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
