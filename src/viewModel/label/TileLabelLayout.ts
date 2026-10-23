import type { CharWidthMeasurer } from './CharWidthMeasurer';
import { LabelLineFitter } from './LabelLineFitter';

/** A label font as actually rendered: its measured char widths + CSS font size. */
export interface LabelFont {
  readonly measurer: CharWidthMeasurer;
  readonly fontSizePx: number;
}

/** The three treemap label fonts (`styles.css` classes in parentheses). */
export interface LabelFonts {
  /** File + collapsed-folder tiles, incl. corner labels (`.leaf-node__label`). */
  readonly tile: LabelFont;
  /** Folder header below the top level (`.folder-node__label`). */
  readonly folder: LabelFont;
  /** Top-level folder header (`.folder-node__label--top`). */
  readonly topFolder: LabelFont;
}

/** A tile's rect size in LAYOUT units (the unzoomed treemap). */
export interface TileSize {
  readonly width: number;
  readonly height: number;
}

/**
 * One text line in ON-SCREEN px relative to the tile's top-left corner — the
 * renderer draws labels inside a `scale(1 / zoom)` group, so text keeps a
 * constant on-screen size at every zoom level.
 */
export interface LabelLine {
  readonly text: string;
  readonly xPx: number;
  readonly baselinePx: number;
}

export interface TileLabels {
  /** Title lines, left-aligned from the top; empty when no name fits. */
  readonly title: readonly LabelLine[];
  /** Bottom-right corner label (right edge at `xPx`), when it fits. */
  readonly corner: LabelLine | undefined;
}

const NO_LABELS: TileLabels = { title: [], corner: undefined };

/** Inset of tile labels from the tile edges. */
const LABEL_PAD_PX = 3;
const LINE_HEIGHT_EM = 1.2;
/**
 * A tile shows a title only when STRICTLY wider than this — keeps ~3 chars
 * minimum instead of littering slivers with "X…" (was 32 px at the old 9 px font).
 */
const TITLE_MIN_WIDTH_EM = 3.5;
/** Corner label needs title line + spacer line + its own line of height. */
const CORNER_LABEL_MIN_LINES = 3;
const FOLDER_LABEL_X_PX = 5;
/** A folder shows its header label only when its on-screen rect is STRICTLY taller. */
const FOLDER_LABEL_MIN_HEIGHT_PX = 14;
const TOP_FOLDER_BASELINE_PX = 14;
const FOLDER_BASELINE_PX = 12;
const TOP_FOLDER_DEPTH = 1;

/**
 * Decides which treemap labels show and where, from each tile's ON-SCREEN
 * (zoomed) size — so zooming in reveals names that did not fit at zoom 1.
 * Pure: measurement comes in via `LabelFonts`, so this is DOM-free.
 *
 * Tile titles wrap over as many lines as the height allows (collapsed folders:
 * one line) and end in "…" when cut; a shown corner label reserves its own
 * bottom line, so the title never overlaps it. Folder headers are one line
 * ("…" when cut) — the header strip has a fixed height.
 */
export class TileLabelLayout {
  private readonly tileFitter: LabelLineFitter;
  private readonly folderFitter: LabelLineFitter;
  private readonly topFolderFitter: LabelLineFitter;
  private readonly lineHeightPx: number;
  private readonly titleMinWidthPx: number;

  constructor(private readonly fonts: LabelFonts) {
    this.tileFitter = new LabelLineFitter(fonts.tile.measurer);
    this.folderFitter = new LabelLineFitter(fonts.folder.measurer);
    this.topFolderFitter = new LabelLineFitter(fonts.topFolder.measurer);
    this.lineHeightPx = fonts.tile.fontSizePx * LINE_HEIGHT_EM;
    this.titleMinWidthPx = fonts.tile.fontSizePx * TITLE_MIN_WIDTH_EM;
  }

  /** File tile: wrapped name + optional corner label (e.g. "3d ago"). */
  leafLabels(tile: TileSize, zoomScale: number, name: string, cornerText: string | undefined): TileLabels {
    return this.tileLabels(tile, zoomScale, name, cornerText, Number.POSITIVE_INFINITY);
  }

  /** Collapsed dense folder tile: single-line name + file-count corner label. */
  collapsedFolderLabels(tile: TileSize, zoomScale: number, name: string, countLabel: string): TileLabels {
    return this.tileLabels(tile, zoomScale, name, countLabel, 1);
  }

  /** Folder header: single line, `undefined` when the rect is too small for it. */
  folderLabel(tile: TileSize, zoomScale: number, name: string, depth: number): LabelLine | undefined {
    if (tile.height * zoomScale <= FOLDER_LABEL_MIN_HEIGHT_PX) return undefined;
    const isTop = depth === TOP_FOLDER_DEPTH;
    const fitter = isTop ? this.topFolderFitter : this.folderFitter;
    const [text] = fitter.fitLines(name, tile.width * zoomScale - 2 * FOLDER_LABEL_X_PX, 1);
    if (text === undefined) return undefined;
    return { text, xPx: FOLDER_LABEL_X_PX, baselinePx: isTop ? TOP_FOLDER_BASELINE_PX : FOLDER_BASELINE_PX };
  }

  private tileLabels(
    tile: TileSize,
    zoomScale: number,
    title: string,
    cornerText: string | undefined,
    maxTitleLines: number,
  ): TileLabels {
    const width = tile.width * zoomScale;
    const height = tile.height * zoomScale;
    // Cheap early exit — most tiles of a big vault are slivers at zoom 1.
    if (height < LABEL_PAD_PX + this.lineHeightPx) return NO_LABELS;

    const corner = this.cornerLine(width, height, cornerText);
    // Title line i occupies [pad + i·lh, pad + (i+1)·lh]; a corner label keeps
    // its own bottom band [height − pad − lh, height − pad] free.
    const titleBottom = corner ? height - LABEL_PAD_PX - this.lineHeightPx : height;
    const lineCount = Math.min(maxTitleLines, Math.floor((titleBottom - LABEL_PAD_PX) / this.lineHeightPx));
    const lines = width > this.titleMinWidthPx
      ? this.tileFitter.fitLines(title, width - 2 * LABEL_PAD_PX, lineCount)
      : [];
    return {
      title: lines.map((text, i) => ({
        text,
        xPx: LABEL_PAD_PX,
        baselinePx: LABEL_PAD_PX + this.fonts.tile.fontSizePx + i * this.lineHeightPx,
      })),
      corner,
    };
  }

  private cornerLine(width: number, height: number, text: string | undefined): LabelLine | undefined {
    if (text === undefined || height < CORNER_LABEL_MIN_LINES * this.lineHeightPx) return undefined;
    if (width < this.tileTextWidth(text) + 2 * LABEL_PAD_PX) return undefined;
    return { text, xPx: width - LABEL_PAD_PX, baselinePx: height - LABEL_PAD_PX };
  }

  private tileTextWidth(text: string): number {
    let sum = 0;
    for (const ch of text) sum += this.fonts.tile.measurer.charWidth(ch);
    return sum;
  }
}
