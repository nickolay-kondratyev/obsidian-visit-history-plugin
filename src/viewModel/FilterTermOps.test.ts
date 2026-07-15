import { describe, expect, it } from 'vitest';
import { FilterTermOps } from './FilterTermOps';
import type { FilterTerm } from './heatmapConfig';

describe('FilterTermOps', () => {
  describe('add', () => {
    it('should append a new trimmed term', () => {
      // GIVEN an existing list and raw text with whitespace
      const terms: FilterTerm[] = [{ kind: 'path', text: 'alpha' }];
      // WHEN adding
      const next = FilterTermOps.add(terms, 'content', '  TODO  ');
      // THEN the trimmed term is appended
      expect(next).toEqual([
        { kind: 'path', text: 'alpha' },
        { kind: 'content', text: 'TODO' },
      ]);
    });

    it('should return the SAME reference for whitespace-only text (no-op)', () => {
      // GIVEN any list
      const terms: FilterTerm[] = [];
      // WHEN adding blank text
      const next = FilterTermOps.add(terms, 'path', '   ');
      // THEN nothing changed — reference equality signals the no-op
      expect(next).toBe(terms);
    });

    it('should return the SAME reference for a case-insensitive same-kind duplicate', () => {
      // GIVEN a list already holding the term in another casing
      const terms: FilterTerm[] = [{ kind: 'path', text: 'Alpha' }];
      // WHEN adding the lowercase variant
      const next = FilterTermOps.add(terms, 'path', 'alpha');
      // THEN the duplicate is ignored
      expect(next).toBe(terms);
    });

    it('should allow the same text on a DIFFERENT kind', () => {
      // GIVEN a path term
      const terms: FilterTerm[] = [{ kind: 'path', text: 'alpha' }];
      // WHEN adding the same text as a content term
      const next = FilterTermOps.add(terms, 'content', 'alpha');
      // THEN both kinds coexist
      expect(next).toHaveLength(2);
    });

    it('should not mutate the input list', () => {
      // GIVEN a list
      const terms: FilterTerm[] = [{ kind: 'path', text: 'alpha' }];
      // WHEN adding
      FilterTermOps.add(terms, 'path', 'beta');
      // THEN the original is untouched
      expect(terms).toEqual([{ kind: 'path', text: 'alpha' }]);
    });
  });

  describe('remove', () => {
    it('should remove only the exact (kind, text) match', () => {
      // GIVEN same text under both kinds
      const terms: FilterTerm[] = [
        { kind: 'path', text: 'alpha' },
        { kind: 'content', text: 'alpha' },
      ];
      // WHEN removing the path term
      const next = FilterTermOps.remove(terms, { kind: 'path', text: 'alpha' });
      // THEN the content term survives
      expect(next).toEqual([{ kind: 'content', text: 'alpha' }]);
    });
  });

  describe('textsOfKind', () => {
    it('should return texts of the requested kind in list order', () => {
      // GIVEN a mixed list
      const terms: FilterTerm[] = [
        { kind: 'content', text: 'TODO' },
        { kind: 'path', text: 'alpha' },
        { kind: 'content', text: 'FIXME' },
      ];
      // WHEN selecting content terms
      // THEN only they are returned, in order
      expect(FilterTermOps.textsOfKind(terms, 'content')).toEqual(['TODO', 'FIXME']);
    });
  });
});
