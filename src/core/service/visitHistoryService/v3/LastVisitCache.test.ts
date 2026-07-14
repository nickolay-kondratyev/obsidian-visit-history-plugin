import { describe, expect, it } from 'vitest';
import { LastVisitCache } from './LastVisitCache';

const DOC_ID = 'docid_A_E';

describe('LastVisitCache', () => {
  describe('get', () => {
    it('should return undefined on a cache miss', () => {
      expect(new LastVisitCache().get(DOC_ID)).toBeUndefined();
    });

    it('should keep a cached "never visited" (null) distinguishable from a miss', () => {
      // GIVEN a cached null lookup result
      const cache = new LastVisitCache();
      cache.set(DOC_ID, null);
      // THEN the entry exists with value null
      expect(cache.get(DOC_ID)).toEqual({ value: null });
    });
  });

  describe('noteVisit', () => {
    it('should create an entry when none is cached', () => {
      // GIVEN an empty cache
      const cache = new LastVisitCache();
      // WHEN a visit is written through
      cache.noteVisit(DOC_ID, 1000);
      // THEN it becomes the cached last visit
      expect(cache.get(DOC_ID)).toEqual({ value: 1000 });
    });

    it('should raise a cached older value', () => {
      // GIVEN an older cached last visit
      const cache = new LastVisitCache();
      cache.set(DOC_ID, 1000);
      // WHEN a newer visit is written through
      cache.noteVisit(DOC_ID, 2000);
      // THEN the cache holds the newer stamp
      expect(cache.get(DOC_ID)).toEqual({ value: 2000 });
    });

    it('should never lower a cached newer value (out-of-order session close)', () => {
      // GIVEN a newer cached last visit
      const cache = new LastVisitCache();
      cache.set(DOC_ID, 2000);
      // WHEN an older session start is written through
      cache.noteVisit(DOC_ID, 1000);
      // THEN the newer stamp is kept
      expect(cache.get(DOC_ID)).toEqual({ value: 2000 });
    });

    it('should replace a cached "never visited" with the visit', () => {
      // GIVEN a cached null result
      const cache = new LastVisitCache();
      cache.set(DOC_ID, null);
      // WHEN a visit is written through
      cache.noteVisit(DOC_ID, 1000);
      // THEN the visit wins
      expect(cache.get(DOC_ID)).toEqual({ value: 1000 });
    });
  });
});
