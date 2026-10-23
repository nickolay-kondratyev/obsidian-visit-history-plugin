import { describe, expect, it } from 'vitest';
import { TileTapRules } from './TileTapRules';

const FILE_A = 'notes/a.md';
const FILE_B = 'notes/b.md';

describe('TileTapRules', () => {
  describe('pointerKind', () => {
    it('should classify a touch pointer as touch', () => {
      expect(TileTapRules.pointerKind('touch')).toBe('touch');
    });

    it('should classify a mouse pointer as mouse-like', () => {
      expect(TileTapRules.pointerKind('mouse')).toBe('mouseLike');
    });

    it('should classify a pen pointer as mouse-like (behavior unchanged for pens)', () => {
      expect(TileTapRules.pointerKind('pen')).toBe('mouseLike');
    });

    it('should classify an unknown/empty pointer type as mouse-like', () => {
      expect(TileTapRules.pointerKind('')).toBe('mouseLike');
    });
  });

  describe('showsHoverTooltip', () => {
    it('should show the hover tooltip for mouse-like pointers', () => {
      expect(TileTapRules.showsHoverTooltip('mouseLike')).toBe(true);
    });

    it('should NOT show the hover tooltip for touch (no tooltip flash under the finger)', () => {
      expect(TileTapRules.showsHoverTooltip('touch')).toBe(false);
    });
  });

  describe('fileTile', () => {
    describe('GIVEN nothing is selected', () => {
      describe('WHEN a file tile is touch-tapped', () => {
        const outcome = TileTapRules.fileTile(undefined, FILE_A, 'touch');

        it('should select the tapped file', () => {
          expect(outcome.selectedPath).toBe(FILE_A);
        });

        it('should NOT open the file', () => {
          expect(outcome.effect).toEqual({ kind: 'none' });
        });
      });

      describe('WHEN a file tile is clicked with the mouse', () => {
        const outcome = TileTapRules.fileTile(undefined, FILE_A, 'mouseLike');

        it('should open the file at once', () => {
          expect(outcome.effect).toEqual({ kind: 'openFile', path: FILE_A });
        });

        it('should NOT select anything', () => {
          expect(outcome.selectedPath).toBeUndefined();
        });
      });
    });

    describe('GIVEN file A is selected', () => {
      describe('WHEN file A is touch-tapped again', () => {
        const outcome = TileTapRules.fileTile(FILE_A, FILE_A, 'touch');

        it('should open file A', () => {
          expect(outcome.effect).toEqual({ kind: 'openFile', path: FILE_A });
        });

        it('should keep file A selected', () => {
          expect(outcome.selectedPath).toBe(FILE_A);
        });
      });

      describe('WHEN a different file B is touch-tapped', () => {
        const outcome = TileTapRules.fileTile(FILE_A, FILE_B, 'touch');

        it('should move the selection to file B', () => {
          expect(outcome.selectedPath).toBe(FILE_B);
        });

        it('should NOT open anything', () => {
          expect(outcome.effect).toEqual({ kind: 'none' });
        });
      });

      describe('WHEN a different file B is clicked with the mouse', () => {
        const outcome = TileTapRules.fileTile(FILE_A, FILE_B, 'mouseLike');

        it('should open file B at once', () => {
          expect(outcome.effect).toEqual({ kind: 'openFile', path: FILE_B });
        });
      });
    });
  });

  describe('folder', () => {
    describe('GIVEN file A is selected WHEN a folder is tapped', () => {
      const outcome = TileTapRules.folder();

      it('should drill in right away', () => {
        expect(outcome.effect).toEqual({ kind: 'drillIn' });
      });

      it('should close the card (clear the selection)', () => {
        expect(outcome.selectedPath).toBeUndefined();
      });
    });
  });

  describe('emptySpace', () => {
    describe('GIVEN file A is selected', () => {
      describe('WHEN empty space is touch-tapped', () => {
        const outcome = TileTapRules.emptySpace(FILE_A, 'touch');

        it('should clear the selection (close the card)', () => {
          expect(outcome.selectedPath).toBeUndefined();
        });

        it('should have no other effect', () => {
          expect(outcome.effect).toEqual({ kind: 'none' });
        });
      });

      describe('WHEN empty space is clicked with the mouse', () => {
        const outcome = TileTapRules.emptySpace(FILE_A, 'mouseLike');

        it('should leave the selection as it was', () => {
          expect(outcome.selectedPath).toBe(FILE_A);
        });

        it('should have no effect', () => {
          expect(outcome.effect).toEqual({ kind: 'none' });
        });
      });
    });

    describe('GIVEN nothing is selected WHEN empty space is clicked with the mouse', () => {
      it('should do nothing (desktop behavior unchanged)', () => {
        expect(TileTapRules.emptySpace(undefined, 'mouseLike')).toEqual({
          selectedPath: undefined,
          effect: { kind: 'none' },
        });
      });
    });
  });

  describe('openButton', () => {
    describe('GIVEN file A is selected WHEN Open is tapped', () => {
      const outcome = TileTapRules.openButton(FILE_A);

      it('should open file A', () => {
        expect(outcome.effect).toEqual({ kind: 'openFile', path: FILE_A });
      });

      it('should keep file A selected', () => {
        expect(outcome.selectedPath).toBe(FILE_A);
      });
    });
  });
});
