import type { CharWidthMeasurer } from '../viewModel/label/CharWidthMeasurer';

/** Fake label-font widths: CJK = one em-ish, everything else (incl. "…") narrower. */
export const FAKE_LATIN_CHAR_WIDTH_PX = 6;
export const FAKE_CJK_CHAR_WIDTH_PX = 10;
const CJK_CHAR = /[一-鿿＀-｠]/u;

/** Deterministic per-character widths for label fitting tests (no DOM). */
export class FakeCharWidthMeasurer implements CharWidthMeasurer {
  charWidth(char: string): number {
    return CJK_CHAR.test(char) ? FAKE_CJK_CHAR_WIDTH_PX : FAKE_LATIN_CHAR_WIDTH_PX;
  }
}
