import { describe, expect, it } from 'vitest';
import { StampLineParser } from './StampLineParser';

describe('StampLineParser', () => {
  describe('parseIsoMs', () => {
    it('should parse a UTC millisecond stamp', () => {
      expect(StampLineParser.parseIsoMs('2026-06-23T12:34:56.789Z'))
        .toBe(Date.parse('2026-06-23T12:34:56.789Z'));
    });

    it('should parse a stamp with a timezone offset', () => {
      expect(StampLineParser.parseIsoMs('2026-06-23T12:34:56.789+02:00'))
        .toBe(Date.parse('2026-06-23T12:34:56.789+02:00'));
    });

    it('should tolerate surrounding whitespace', () => {
      expect(StampLineParser.parseIsoMs('  2026-06-23T12:34:56.789Z  ')).not.toBeNull();
    });

    it('should reject a well-formed but impossible date (month 13) instead of returning NaN', () => {
      // The shape regex passes but Date.parse yields NaN — must map to null,
      // or the NaN poisons every max-aggregation downstream.
      expect(StampLineParser.parseIsoMs('2026-13-01T00:00:00.000Z')).toBeNull();
    });

    it('should reject an impossible time-of-day (hour 25)', () => {
      expect(StampLineParser.parseIsoMs('2026-07-09T25:02:15.745Z')).toBeNull();
    });

    it('should reject a legacy epoch-ms integer', () => {
      expect(StampLineParser.parseIsoMs('1781639192842')).toBeNull();
    });

    it('should reject loose date text (no bare Date.parse)', () => {
      expect(StampLineParser.parseIsoMs('March 2026')).toBeNull();
    });

    it('should reject header/comment lines', () => {
      expect(StampLineParser.parseIsoMs('### VISIT_HISTORY_V1:')).toBeNull();
    });
  });
});
