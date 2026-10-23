import { describe, expect, it } from 'vitest';
import { CachingCharWidthMeasurer } from './CharWidthMeasurer';

const RAW_WIDTH_PX = 7;

describe('CachingCharWidthMeasurer', () => {
  describe('charWidth', () => {
    function countingMeasurer(): { measurer: CachingCharWidthMeasurer; calls: string[] } {
      const calls: string[] = [];
      const measurer = new CachingCharWidthMeasurer((ch) => {
        calls.push(ch);
        return RAW_WIDTH_PX;
      });
      return { measurer, calls };
    }

    it('should return the raw measurement', () => {
      const { measurer } = countingMeasurer();

      expect(measurer.charWidth('a')).toBe(RAW_WIDTH_PX);
    });

    it('should measure a repeated character only once', () => {
      // GIVEN a char already measured
      const { measurer, calls } = countingMeasurer();
      measurer.charWidth('中');

      // WHEN it is asked for again
      measurer.charWidth('中');

      // THEN the raw measurement ran once
      expect(calls).toEqual(['中']);
    });

    it('should measure each distinct character', () => {
      const { measurer, calls } = countingMeasurer();

      measurer.charWidth('a');
      measurer.charWidth('b');

      expect(calls).toEqual(['a', 'b']);
    });
  });
});
