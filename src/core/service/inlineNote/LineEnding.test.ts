import { describe, expect, it } from 'vitest';
import { LineEnding } from './LineEnding';

describe('LineEnding', () => {
  describe('detect', () => {
    it('should detect CRLF from the first line break', () => {
      expect(LineEnding.detect('a\r\nb')).toBe('\r\n');
    });

    it('should detect LF from the first line break', () => {
      expect(LineEnding.detect('a\nb\r\nc')).toBe('\n');
    });

    it('should default to LF for a single-line note', () => {
      expect(LineEnding.detect('a')).toBe('\n');
    });
  });

  describe('splitLines', () => {
    it('should split on both line endings without keeping CR', () => {
      expect(LineEnding.splitLines('a\r\nb\nc\r\n')).toEqual(['a', 'b', 'c', '']);
    });
  });

  describe('joinLines', () => {
    it('should drop a stray trailing CR before joining', () => {
      expect(LineEnding.joinLines(['a\r', 'b'], '\r\n')).toBe('a\r\nb');
    });
  });
});
