import { describe, expect, it } from 'vitest';
import { TileLabelLayout, type LabelFont, type TileLabels } from './TileLabelLayout';
import { FakeCharWidthMeasurer } from '../../testSupport/FakeCharWidthMeasurer';

// GIVEN all label fonts at 10 px over fake widths (Latin 6 px) →
// line height 12, pad 3, title needs width > 35.
const FONT_SIZE_PX = 10;
const LINE_HEIGHT_PX = 12;
const FONT: LabelFont = { measurer: new FakeCharWidthMeasurer(), fontSizePx: FONT_SIZE_PX };
const layout = new TileLabelLayout({ tile: FONT, folder: FONT, topFolder: FONT });

const ZOOM_1 = 1;
const LONG_NAME = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda';
// '33m ago' = 7 chars × 6 = 42 px + 2 × 3 px pad → fits from width 48.
const AGO = '33m ago';
const AGO_MIN_WIDTH = 48;
const CORNER_MIN_HEIGHT = 3 * LINE_HEIGHT_PX;

function titleTexts(labels: TileLabels): string[] {
  return labels.title.map((l) => l.text);
}

describe('TileLabelLayout', () => {
  describe('leafLabels', () => {
    describe('title', () => {
      it('should show a name that fits in full on one line', () => {
        const labels = layout.leafLabels({ width: 100, height: 60 }, ZOOM_1, 'Short.md', undefined);

        expect(titleTexts(labels)).toEqual(['Short.md']);
      });

      it('should wrap over as many lines as the tile height allows', () => {
        // (60 − 3 pad) / 12 → 4 lines
        const labels = layout.leafLabels({ width: 100, height: 60 }, ZOOM_1, LONG_NAME, undefined);

        expect(labels.title).toHaveLength(4);
      });

      it('should end the last visible line with an ellipsis when the name is cut', () => {
        const labels = layout.leafLabels({ width: 100, height: 60 }, ZOOM_1, LONG_NAME, undefined);

        expect(labels.title.at(-1)?.text.endsWith('…')).toBe(true);
      });

      it('should stack lines one line height apart', () => {
        const labels = layout.leafLabels({ width: 100, height: 60 }, ZOOM_1, LONG_NAME, undefined);

        expect(labels.title.map((l) => l.baselinePx)).toEqual([13, 25, 37, 49]);
      });

      it('should show no title on a tile exactly at the minimum width', () => {
        const labels = layout.leafLabels({ width: 35, height: 60 }, ZOOM_1, 'ab', undefined);

        expect(labels.title).toEqual([]);
      });

      it('should show a title on a tile one px wider than the minimum width', () => {
        const labels = layout.leafLabels({ width: 36, height: 60 }, ZOOM_1, 'ab', undefined);

        expect(titleTexts(labels)).toEqual(['ab']);
      });

      it('should show no title on a tile shorter than one line', () => {
        const labels = layout.leafLabels({ width: 100, height: 14 }, ZOOM_1, 'ab', undefined);

        expect(labels.title).toEqual([]);
      });

      it('should show one title line on a tile exactly one line tall', () => {
        const labels = layout.leafLabels({ width: 100, height: 15 }, ZOOM_1, 'ab', undefined);

        expect(titleTexts(labels)).toEqual(['ab']);
      });
    });

    describe('corner label', () => {
      it('should fit when the tile has room for title, blank line and label', () => {
        const labels = layout.leafLabels({ width: AGO_MIN_WIDTH, height: CORNER_MIN_HEIGHT }, ZOOM_1, 'a', AGO);

        expect(labels.corner?.text).toBe(AGO);
      });

      it('should not fit when the tile is one px short of three lines', () => {
        const labels = layout.leafLabels({ width: 200, height: CORNER_MIN_HEIGHT - 1 }, ZOOM_1, 'a', AGO);

        expect(labels.corner).toBeUndefined();
      });

      it('should not fit when the tile is one px narrower than the measured label', () => {
        const labels = layout.leafLabels({ width: AGO_MIN_WIDTH - 1, height: 200 }, ZOOM_1, 'a', AGO);

        expect(labels.corner).toBeUndefined();
      });

      it('should require more width for a longer label', () => {
        // '400d ago' = 8 chars → needs 8 × 6 + 2 × 3 = 54 px, more than '33m ago' fits in
        const labels = layout.leafLabels({ width: AGO_MIN_WIDTH, height: 200 }, ZOOM_1, 'a', '400d ago');

        expect(labels.corner).toBeUndefined();
      });

      it('should sit in the bottom-right corner', () => {
        const labels = layout.leafLabels({ width: 100, height: 50 }, ZOOM_1, 'a', AGO);

        expect(labels.corner).toEqual({ text: AGO, xPx: 97, baselinePx: 47 });
      });

      it('should never let the title overlap it', () => {
        // GIVEN tiles of many heights, each with a long name AND a corner label
        const heights = [36, 40, 47, 48, 59, 60, 61, 100, 137];

        // WHEN laid out, THEN the last title baseline stays a full line above the corner baseline
        const overlapping = heights.filter((height) => {
          const { title, corner } = layout.leafLabels({ width: 100, height }, ZOOM_1, LONG_NAME, AGO);
          const last = title.at(-1);
          return !corner || !last || last.baselinePx > corner.baselinePx - LINE_HEIGHT_PX;
        });
        expect(overlapping).toEqual([]);
      });

      it('should leave the title one line fewer than without a corner label', () => {
        const tile = { width: 100, height: 60 };

        const withCorner = layout.leafLabels(tile, ZOOM_1, LONG_NAME, AGO);

        expect(withCorner.title).toHaveLength(layout.leafLabels(tile, ZOOM_1, LONG_NAME, undefined).title.length - 1);
      });
    });

    describe('zoom', () => {
      // GIVEN a tile too small for any label at zoom 1
      const tinyTile = { width: 20, height: 10 };

      it('should show no name at zoom 1 on a tiny tile', () => {
        expect(layout.leafLabels(tinyTile, ZOOM_1, 'alpha', undefined).title).toEqual([]);
      });

      it('should show the name once zoomed in enough', () => {
        const zoomed = layout.leafLabels(tinyTile, 4, 'alpha', undefined);

        expect(titleTexts(zoomed)).toEqual(['alpha']);
      });

      it('should fit the name to the ON-SCREEN width', () => {
        // 50 layout px × 3 = 150 on-screen px → the whole name fits on one line
        const labels = layout.leafLabels({ width: 50, height: 20 }, 3, 'alpha beta gamma', undefined);

        expect(titleTexts(labels)).toEqual(['alpha beta gamma']);
      });

      it('should truncate the same name at zoom 1', () => {
        const labels = layout.leafLabels({ width: 50, height: 20 }, ZOOM_1, 'alpha beta gamma', undefined);

        expect(titleTexts(labels)).toEqual(['alpha…']);
      });

      it('should keep label positions in constant on-screen px at any zoom', () => {
        const tile = { width: 100, height: 50 };

        const zoomed = layout.leafLabels(tile, 4, 'alpha', undefined).title[0];

        expect(zoomed).toEqual(layout.leafLabels(tile, ZOOM_1, 'alpha', undefined).title[0]);
      });

      it('should place the corner label at the on-screen corner', () => {
        const labels = layout.leafLabels({ width: 25, height: 20 }, 4, 'a', AGO);

        expect(labels.corner).toEqual({ text: AGO, xPx: 97, baselinePx: 77 });
      });
    });
  });

  describe('collapsedFolderLabels', () => {
    it('should truncate the name to a single line even on a tall tile', () => {
      const labels = layout.collapsedFolderLabels({ width: 60, height: 200 }, ZOOM_1, LONG_NAME, '12 files');

      expect(titleTexts(labels)).toEqual(['alpha be…']);
    });

    it('should show the file count in the corner', () => {
      const labels = layout.collapsedFolderLabels({ width: 100, height: 100 }, ZOOM_1, 'notes', '12 files');

      expect(labels.corner?.text).toBe('12 files');
    });
  });

  describe('folderLabel', () => {
    it('should show a name that fits in full', () => {
      const label = layout.folderLabel({ width: 200, height: 100 }, ZOOM_1, 'NOTES', 2);

      expect(label?.text).toBe('NOTES');
    });

    it('should truncate a long name to one line with an ellipsis', () => {
      // (60 − 2 × 5 px inset) = 50 px → 7 chars + "…"
      const label = layout.folderLabel({ width: 60, height: 100 }, ZOOM_1, LONG_NAME, 2);

      expect(label?.text).toBe('alpha b…');
    });

    it('should hide the label on a rect exactly at the minimum height', () => {
      expect(layout.folderLabel({ width: 200, height: 14 }, ZOOM_1, 'NOTES', 2)).toBeUndefined();
    });

    it('should show the label once zoomed in enough', () => {
      const label = layout.folderLabel({ width: 200, height: 14 }, 2, 'NOTES', 2);

      expect(label?.text).toBe('NOTES');
    });

    it('should use the top-level baseline for a depth-1 folder', () => {
      const label = layout.folderLabel({ width: 200, height: 100 }, ZOOM_1, 'NOTES', 1);

      expect(label?.baselinePx).toBe(14);
    });

    it('should use the nested baseline below the top level', () => {
      const label = layout.folderLabel({ width: 200, height: 100 }, ZOOM_1, 'NOTES', 2);

      expect(label?.baselinePx).toBe(12);
    });
  });
});
