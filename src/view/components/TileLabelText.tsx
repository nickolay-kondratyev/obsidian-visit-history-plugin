import type { TileLabels } from '../../viewModel/label/TileLabelLayout';

interface TileLabelTextProps {
  labels: TileLabels;
  zoomScale: number;
  /** Extra class for the corner label (its own fill tint). */
  cornerClassName: string;
}

/**
 * Draws a tile's title lines (one `<tspan>` per line) and corner label.
 * Positions are ON-SCREEN px: the `scale(1 / zoom)` group undoes the treemap
 * zoom, so text keeps a constant on-screen size at every zoom level.
 * WHY-NOT foreignObject + CSS wrapping: iOS WebKit misplaces foreignObject
 * content under transformed parents, and the zoom is a transform.
 */
export function TileLabelText({ labels, zoomScale, cornerClassName }: TileLabelTextProps) {
  const { title, corner } = labels;
  if (title.length === 0 && !corner) return null;
  return (
    <g transform={`scale(${1 / zoomScale})`}>
      {title.length > 0 && (
        <text className="leaf-node__label">
          {title.map((line, i) => (
            <tspan key={i} x={line.xPx} y={line.baselinePx}>
              {line.text}
            </tspan>
          ))}
        </text>
      )}
      {corner && (
        <text
          x={corner.xPx}
          y={corner.baselinePx}
          textAnchor="end"
          className={`leaf-node__label ${cornerClassName}`}
        >
          {corner.text}
        </text>
      )}
    </g>
  );
}
