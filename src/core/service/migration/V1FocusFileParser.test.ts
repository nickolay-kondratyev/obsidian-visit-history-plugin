import { describe, expect, it } from 'vitest';
import { V1FocusFileParser } from './V1FocusFileParser';

const VH_HEADER =
  'VISIT_HISTORY_V1_FOR:[[notes/target.md]]\n' +
  '### VISIT_HISTORY_V1:\n';

const ISO_STAMP = '2026-06-23T12:34:56.789Z';
const ISO_STAMP_MS = Date.parse(ISO_STAMP);
const LEGACY_EPOCH_MS = 1781639192842;

describe('V1FocusFileParser', () => {
  describe('parse — backlink target', () => {
    it('should extract the full-path link text', () => {
      expect(V1FocusFileParser.parse(VH_HEADER).backlinkTargetLinkText).toBe('notes/target.md');
    });

    it('should strip an alias suffix from the link', () => {
      const content = 'VISIT_HISTORY_V1_FOR:[[notes/target.md|Nice Alias]]\n';
      expect(V1FocusFileParser.parse(content).backlinkTargetLinkText).toBe('notes/target.md');
    });

    it('should strip a heading suffix from the link', () => {
      const content = 'VISIT_HISTORY_V1_FOR:[[notes/target.md#Section]]\n';
      expect(V1FocusFileParser.parse(content).backlinkTargetLinkText).toBe('notes/target.md');
    });

    it('should return null when the backlink line is missing', () => {
      expect(V1FocusFileParser.parse(`### VISIT_HISTORY_V1:\n${ISO_STAMP}\n`).backlinkTargetLinkText)
        .toBeNull();
    });

    it('should return null for an empty file', () => {
      expect(V1FocusFileParser.parse('').backlinkTargetLinkText).toBeNull();
    });
  });

  describe('parse — stamps', () => {
    it('should parse an ISO 8601 stamp line', () => {
      expect(V1FocusFileParser.parse(`${VH_HEADER}${ISO_STAMP}\n`).stampsMs).toEqual([ISO_STAMP_MS]);
    });

    it('should parse a legacy epoch-ms numeric line', () => {
      expect(V1FocusFileParser.parse(`${VH_HEADER}${LEGACY_EPOCH_MS}\n`).stampsMs)
        .toEqual([LEGACY_EPOCH_MS]);
    });

    it('should return ALL stamps in file order (mixed formats)', () => {
      const content = `${VH_HEADER}${LEGACY_EPOCH_MS}\n${ISO_STAMP}\n`;
      expect(V1FocusFileParser.parse(content).stampsMs).toEqual([LEGACY_EPOCH_MS, ISO_STAMP_MS]);
    });

    it('should ignore blank lines', () => {
      expect(V1FocusFileParser.parse(`${VH_HEADER}${ISO_STAMP}\n\n  \n`).stampsMs)
        .toEqual([ISO_STAMP_MS]);
    });

    it('should return [] for a header-only VH file with no stamps yet', () => {
      expect(V1FocusFileParser.parse(VH_HEADER).stampsMs).toEqual([]);
    });

    it('should skip a non-stamp line (manual user note) between stamps', () => {
      const content = `${VH_HEADER}${ISO_STAMP}\nsome manual user note\n${LEGACY_EPOCH_MS}\n`;
      expect(V1FocusFileParser.parse(content).stampsMs).toEqual([ISO_STAMP_MS, LEGACY_EPOCH_MS]);
    });

    it('should not misparse loose date text as a stamp (no bare Date.parse)', () => {
      expect(V1FocusFileParser.parse(`${VH_HEADER}March 2026 review\n`).stampsMs).toEqual([]);
    });
  });
});
