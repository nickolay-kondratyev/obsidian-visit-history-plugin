import { describe, expect, it } from 'vitest';
import { FocusFile } from './FocusFile';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';

const VH_PATH = '_visit_history/v1/focus/device-a/_vh_01ABC.md';
const VH_HEADER =
  'VISIT_HISTORY_V1_FOR:[[notes/target.md]]\n' +
  '### VISIT_HISTORY_V1:\n';

const ISO_STAMP = '2026-06-23T12:34:56.789Z';
const ISO_STAMP_MS = Date.parse(ISO_STAMP);
const LEGACY_EPOCH_MS = 1781639192842;

function givenVhFileWithContent(content: string): { focusFile: FocusFile; noteFileUtil: FakeNoteFileUtil } {
  const noteFileUtil = new FakeNoteFileUtil();
  const file = noteFileUtil.seedNote(VH_PATH, content);
  return { focusFile: new FocusFile(file), noteFileUtil };
}

describe('FocusFile', () => {
  describe('getLastStamp', () => {
    it('should parse an ISO 8601 last line', async () => {
      // GIVEN a VH file whose last line is an ISO stamp
      const { focusFile, noteFileUtil } = givenVhFileWithContent(`${VH_HEADER}${ISO_STAMP}\n`);
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN it is the ISO stamp in epoch ms
      expect(stamp).toBe(ISO_STAMP_MS);
    });

    it('should parse a legacy epoch-ms numeric last line', async () => {
      // GIVEN a VH file written before the ISO 8601 transition
      const { focusFile, noteFileUtil } = givenVhFileWithContent(`${VH_HEADER}${LEGACY_EPOCH_MS}\n`);
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN the raw epoch ms is returned
      expect(stamp).toBe(LEGACY_EPOCH_MS);
    });

    it('should return the LAST stamp when multiple stamps exist', async () => {
      // GIVEN a VH file with a legacy stamp followed by an ISO stamp
      const { focusFile, noteFileUtil } = givenVhFileWithContent(
        `${VH_HEADER}${LEGACY_EPOCH_MS}\n${ISO_STAMP}\n`,
      );
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN the most recent (last) stamp wins
      expect(stamp).toBe(ISO_STAMP_MS);
    });

    it('should ignore trailing blank lines', async () => {
      // GIVEN a VH file with blank lines after the last stamp
      const { focusFile, noteFileUtil } = givenVhFileWithContent(`${VH_HEADER}${ISO_STAMP}\n\n  \n`);
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN the stamp is still found
      expect(stamp).toBe(ISO_STAMP_MS);
    });

    it('should return null for a header-only VH file with no stamps yet', async () => {
      // GIVEN a freshly created VH file (header lines only, no visit appended yet)
      const { focusFile, noteFileUtil } = givenVhFileWithContent(VH_HEADER);
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN null is returned instead of throwing (a single malformed VH file
      // must never break aggregation across all VH files)
      expect(stamp).toBeNull();
    });

    it('should return null for an empty file', async () => {
      // GIVEN an empty VH file
      const { focusFile, noteFileUtil } = givenVhFileWithContent('');
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN null is returned
      expect(stamp).toBeNull();
    });

    it('should skip a non-stamp trailing line and return the last parseable stamp', async () => {
      // GIVEN a VH file where the user appended a manual comment after the stamps
      const { focusFile, noteFileUtil } = givenVhFileWithContent(
        `${VH_HEADER}${ISO_STAMP}\nsome manual user note\n`,
      );
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN the scan skips the comment and finds the stamp above it
      expect(stamp).toBe(ISO_STAMP_MS);
    });

    it('should not misparse a year-like header fragment as a date', async () => {
      // GIVEN a file whose last line is text that Date.parse would accept loosely
      const { focusFile, noteFileUtil } = givenVhFileWithContent(`${VH_HEADER}March 2026 review\n`);
      // WHEN reading the last stamp
      const stamp = await focusFile.getLastStamp(noteFileUtil);
      // THEN only strict stamp formats are accepted → null
      expect(stamp).toBeNull();
    });
  });
});
