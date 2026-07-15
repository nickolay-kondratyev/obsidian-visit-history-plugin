import { describe, expect, it, vi } from 'vitest';
import { ContentTermMatcherDefault } from './ContentTermMatcher';
import { FakeNoteFileUtil } from '../testSupport/FakeNoteFileUtil';
import { FakeVaultUtil } from '../testSupport/fakes';
import { makeTFile } from '../testSupport/fileFactory';
import type { TFile } from 'obsidian';

interface Harness {
  matcher: ContentTermMatcherDefault;
  noteFileUtil: FakeNoteFileUtil;
}

/** GIVEN a vault of tracked notes with the given path→content mapping. */
function makeHarness(notes: Record<string, string>, unreadablePaths: string[] = []): Harness {
  const noteFileUtil = new FakeNoteFileUtil();
  const files: TFile[] = Object.entries(notes).map(([path, content]) =>
    noteFileUtil.seedNote(path, content),
  );
  // Unreadable files are tracked but have no content seeded — cachedRead rejects.
  for (const path of unreadablePaths) files.push(makeTFile({ path }));
  return { matcher: new ContentTermMatcherDefault(new FakeVaultUtil(files), noteFileUtil), noteFileUtil };
}

describe('ContentTermMatcherDefault', () => {
  describe('findPathsMatchingAnyTerm', () => {
    it('should return an empty set for empty terms', async () => {
      // GIVEN notes exist but no terms
      const { matcher } = makeHarness({ 'a.md': 'anything' });
      // WHEN matching
      const paths = await matcher.findPathsMatchingAnyTerm([]);
      // THEN nothing matches
      expect(paths.size).toBe(0);
    });

    it('should perform NO file reads for empty terms (fast path)', async () => {
      // GIVEN notes exist but no terms
      const { matcher, noteFileUtil } = makeHarness({ 'a.md': 'anything' });
      // WHEN matching
      await matcher.findPathsMatchingAnyTerm([]);
      // THEN no content was read
      expect(noteFileUtil.cachedReadCallCount).toBe(0);
    });

    it('should match case-insensitively (term TODO vs content "# todo list")', async () => {
      // GIVEN a note whose content matches only case-insensitively
      const { matcher } = makeHarness({ 'a.md': '# todo list' });
      // WHEN matching an uppercase term
      const paths = await matcher.findPathsMatchingAnyTerm(['TODO']);
      // THEN the note matches
      expect([...paths]).toEqual(['a.md']);
    });

    it('should OR across terms with each matching path appearing exactly once', async () => {
      // GIVEN one note hit by BOTH terms and one hit by a single term
      const { matcher } = makeHarness({
        'both.md': 'alpha beta',
        'one.md': 'beta only',
        'none.md': 'gamma',
      });
      // WHEN matching two terms
      const paths = await matcher.findPathsMatchingAnyTerm(['alpha', 'beta']);
      // THEN the union comes back, no duplicates (it is a set)
      expect([...paths].sort()).toEqual(['both.md', 'one.md']);
    });

    it('should skip a file whose read rejects and still evaluate the others', async () => {
      // GIVEN a tracked file with no readable content next to a matching note
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { matcher } = makeHarness({ 'good.md': 'needle here' }, ['broken.md']);
      // WHEN matching
      const paths = await matcher.findPathsMatchingAnyTerm(['needle']);
      // THEN the broken file is a non-match and no error escapes
      expect([...paths]).toEqual(['good.md']);
      errorSpy.mockRestore();
    });

    it('should not include non-matching files', async () => {
      // GIVEN a note without the term
      const { matcher } = makeHarness({ 'a.md': 'nothing relevant' });
      // WHEN matching
      const paths = await matcher.findPathsMatchingAnyTerm(['needle']);
      // THEN the result is empty
      expect(paths.size).toBe(0);
    });
  });
});
