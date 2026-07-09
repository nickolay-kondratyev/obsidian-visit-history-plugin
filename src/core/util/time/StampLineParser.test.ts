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

  describe('parseLegacyOrIsoMs', () => {
    it('should parse a legacy epoch-ms integer', () => {
      expect(StampLineParser.parseLegacyOrIsoMs('1781639192842')).toBe(1781639192842);
    });

    it('should parse an ISO stamp', () => {
      expect(StampLineParser.parseLegacyOrIsoMs('2026-06-23T12:34:56.789Z'))
        .toBe(Date.parse('2026-06-23T12:34:56.789Z'));
    });

    it('should reject non-stamp lines', () => {
      expect(StampLineParser.parseLegacyOrIsoMs('VISIT_HISTORY_V1_FOR:[[a.md]]')).toBeNull();
    });
  });
});
