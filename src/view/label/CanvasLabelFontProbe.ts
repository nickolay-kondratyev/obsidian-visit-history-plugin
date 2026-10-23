import { CachingCharWidthMeasurer } from '../../viewModel/label/CharWidthMeasurer';
import type { LabelFont, LabelFonts } from '../../viewModel/label/TileLabelLayout';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * DOM boundary: reads the treemap label fonts AS RENDERED (theme font family,
 * size and letter-spacing from `styles.css`) and measures characters with a
 * canvas in that exact font — so CJK and wide theme fonts are measured, not
 * guessed. Font size lives only in CSS; everything else derives from it.
 *
 * CEILING: read once per heatmap mount — a theme/font change applies on the
 * next open of the view (upgrade path: re-probe on Obsidian's `css-change`).
 */
export class CanvasLabelFontProbe {
  /** `undefined` (logged) when a font cannot be read — the treemap then draws no labels. */
  static readLabelFonts(svg: SVGSVGElement): LabelFonts | undefined {
    const tile = CanvasLabelFontProbe.read(svg, 'leaf-node__label');
    const folder = CanvasLabelFontProbe.read(svg, 'folder-node__label');
    const topFolder = CanvasLabelFontProbe.read(svg, 'folder-node__label folder-node__label--top');
    if (!tile || !folder || !topFolder) return undefined;
    return { tile, folder, topFolder };
  }

  /** Computed font of a throwaway `<text class=…>` placed inside the treemap svg (scoped CSS applies). */
  private static read(svg: SVGSVGElement, className: string): LabelFont | undefined {
    const doc = svg.ownerDocument;
    const probe = doc.createElementNS(SVG_NS, 'text');
    probe.setAttribute('class', className);
    svg.appendChild(probe);
    const style = doc.defaultView?.getComputedStyle(probe);
    const fontSizePx = style ? parseFloat(style.fontSize) : Number.NaN;
    // 'normal' parses to NaN → no extra spacing.
    const letterSpacingPx = (style ? parseFloat(style.letterSpacing) : 0) || 0;
    const font = style ? `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}` : '';
    probe.remove();

    // Obsidian's global createEl → a detached canvas (main window). Fine for
    // popouts too: the font string is already fully resolved from the probe.
    const ctx = createEl('canvas').getContext('2d');
    if (!ctx || !(fontSizePx > 0)) {
      console.error('Heatmap labels disabled: cannot read label font', { className, fontSizePx });
      return undefined;
    }
    ctx.font = font;
    return {
      fontSizePx,
      // Canvas measureText ignores CSS letter-spacing → added per char.
      measurer: new CachingCharWidthMeasurer((ch) => ctx.measureText(ch).width + letterSpacingPx),
    };
  }
}
