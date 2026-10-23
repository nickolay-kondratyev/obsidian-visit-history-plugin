import { describe, expect, it } from 'vitest';
import { LabelLineFitter } from './LabelLineFitter';
import {
  FAKE_CJK_CHAR_WIDTH_PX,
  FAKE_LATIN_CHAR_WIDTH_PX,
  FakeCharWidthMeasurer,
} from '../../testSupport/FakeCharWidthMeasurer';

/** Width holding exactly `n` Latin chars (the fake "…" is Latin-wide too). */
function latinChars(n: number): number {
  return n * FAKE_LATIN_CHAR_WIDTH_PX;
}

function cjkChars(n: number): number {
  return n * FAKE_CJK_CHAR_WIDTH_PX;
}

const MANY_LINES = 10;

describe('LabelLineFitter', () => {
  // GIVEN a fitter over fake widths (Latin 6 px, CJK 10 px, "…" 6 px).
  const fitter = new LabelLineFitter(new FakeCharWidthMeasurer());

  describe('fitLines', () => {
    describe('when the name fits on one line', () => {
      it('should show it in full with no ellipsis', () => {
        expect(fitter.fitLines('Short.md', latinChars(10), MANY_LINES)).toEqual(['Short.md']);
      });

      it('should show it in full when it fits the width exactly', () => {
        expect(fitter.fitLines('Short.md', latinChars(8), 1)).toEqual(['Short.md']);
      });

      it('should show a one-char name even when "char + …" would not fit', () => {
        expect(fitter.fitLines('A', latinChars(1), 1)).toEqual(['A']);
      });
    });

    describe('when the name is wider than one line', () => {
      it('should wrap at spaces over as many lines as needed', () => {
        expect(fitter.fitLines('alpha beta gamma', latinChars(6), MANY_LINES)).toEqual(['alpha', 'beta', 'gamma']);
      });

      it('should wrap after - _ . separators', () => {
        expect(fitter.fitLines('quarterly-business_review.notes', latinChars(10), MANY_LINES)).toEqual([
          'quarterly-',
          'business_',
          'review.',
          'notes',
        ]);
      });

      it('should break a single long token without break points between any two chars', () => {
        expect(fitter.fitLines('Supercalifragilistic', latinChars(6), MANY_LINES)).toEqual([
          'Superc',
          'alifra',
          'gilist',
          'ic',
        ]);
      });

      it('should break next to a CJK char inside mixed text', () => {
        expect(fitter.fitLines('AB中文', latinChars(2) + cjkChars(1), MANY_LINES)).toEqual(['AB中', '文']);
      });
    });

    describe('when the name is CJK', () => {
      // GIVEN 13 CJK chars and a line that holds exactly 4 of them.
      const name = '关于分布式系统中一致性协议';
      const width = cjkChars(4);

      it('should fill each line up to the measured width (no early cut)', () => {
        expect(fitter.fitLines(name, width, MANY_LINES)[0]).toBe('关于分布');
      });

      it('should break between any two characters', () => {
        expect(fitter.fitLines(name, width, MANY_LINES)).toEqual(['关于分布', '式系统中', '一致性协', '议']);
      });

      it('should end the last allowed line with an ellipsis that still fits the width', () => {
        expect(fitter.fitLines(name, width, 3)).toEqual(['关于分布', '式系统中', '一致性…']);
      });
    });

    describe('when the name needs more lines than allowed', () => {
      it('should end the last visible line with an ellipsis', () => {
        expect(fitter.fitLines('alpha beta gamma delta', latinChars(6), 2)).toEqual(['alpha', 'beta…']);
      });

      it('should truncate a single line with an ellipsis', () => {
        expect(fitter.fitLines('Supercalifragilistic', latinChars(6), 1)).toEqual(['Super…']);
      });
    });

    describe('when the tile is too small for any label', () => {
      it('should return no lines when even the first char + "…" is too wide', () => {
        expect(fitter.fitLines('alpha', latinChars(2) - 1, MANY_LINES)).toEqual([]);
      });

      it('should return no lines when no line is allowed', () => {
        expect(fitter.fitLines('alpha', latinChars(10), 0)).toEqual([]);
      });
    });

    it('should return no lines for a blank name', () => {
      expect(fitter.fitLines('   ', latinChars(10), MANY_LINES)).toEqual([]);
    });
  });
});
