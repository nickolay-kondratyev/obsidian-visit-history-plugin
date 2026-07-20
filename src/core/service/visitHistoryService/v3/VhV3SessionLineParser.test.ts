import { describe, expect, it } from 'vitest';
import { VhV3SessionLineParser } from './VhV3SessionLineParser';

describe('VhV3SessionLineParser', () => {
  describe('parseSession', () => {
    it('should parse a valid session line into start + duration', () => {
      expect(VhV3SessionLineParser.parseSession('2026-07-09T22:02:15.745Z D:5600')).toEqual({
        focusStartEpochMs: Date.parse('2026-07-09T22:02:15.745Z'),
        durationMs: 5600,
      });
    });

    it('should parse a zero-duration session (D:0)', () => {
      expect(VhV3SessionLineParser.parseSession('2026-07-09T22:02:15.745Z D:0'))
        .toEqual({ focusStartEpochMs: Date.parse('2026-07-09T22:02:15.745Z'), durationMs: 0 });
    });

    it('should tolerate surrounding whitespace', () => {
      expect(VhV3SessionLineParser.parseSession('  2026-07-09T22:02:15.745Z D:5600  ')).not.toBeNull();
    });

    it('should reject a line with a malformed ISO stamp', () => {
      expect(VhV3SessionLineParser.parseSession('March-2026 D:5600')).toBeNull();
    });

    it('should reject a well-formed but impossible date (month 13) instead of yielding a NaN start', () => {
      // A single corrupted digit must skip the line, not emit
      // focusStartEpochMs=NaN — NaN would poison the last-visit max-aggregation
      // over ALL of the doc's valid sessions (VhV3DurationStore).
      expect(VhV3SessionLineParser.parseSession('2026-13-01T00:00:00.000Z D:5600')).toBeNull();
    });

    it('should reject a bare stamp missing the ` D:` part', () => {
      expect(VhV3SessionLineParser.parseSession('2026-07-09T22:02:15.745Z')).toBeNull();
    });

    it('should reject a negative duration', () => {
      expect(VhV3SessionLineParser.parseSession('2026-07-09T22:02:15.745Z D:-5')).toBeNull();
    });

    it('should reject garbage millis', () => {
      expect(VhV3SessionLineParser.parseSession('2026-07-09T22:02:15.745Z D:12x4')).toBeNull();
    });

    it('should reject an empty line', () => {
      expect(VhV3SessionLineParser.parseSession('')).toBeNull();
    });

    it('should reject trailing content after the duration', () => {
      expect(VhV3SessionLineParser.parseSession('2026-07-09T22:02:15.745Z D:5600 extra')).toBeNull();
    });
  });
});
