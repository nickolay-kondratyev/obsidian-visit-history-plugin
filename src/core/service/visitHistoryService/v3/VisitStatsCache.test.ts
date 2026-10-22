import { describe, expect, it } from 'vitest';
import { VisitStatsCache } from './VisitStatsCache';
import { VisitStats } from '../VisitStats';

const DOC_ID = 'docid_A_E';
const OTHER_DOC_ID = 'docid_B_E';
const DISK_STATS = new VisitStats(1000, 300);

/** GIVEN a cache already holding DISK_STATS for DOC_ID (cached via a clean read). */
function cacheWithEntry(): VisitStatsCache {
  const cache = new VisitStatsCache();
  cache.setIfNoWriteSince(DOC_ID, DISK_STATS, cache.readToken());
  return cache;
}

describe('VisitStatsCache', () => {
  describe('get', () => {
    it('should return undefined on a cache miss', () => {
      expect(new VisitStatsCache().get(DOC_ID)).toBeUndefined();
    });

    it('should keep cached "never visited" (EMPTY) stats distinguishable from a miss', () => {
      // GIVEN cached EMPTY stats
      const cache = new VisitStatsCache();
      cache.setIfNoWriteSince(DOC_ID, VisitStats.EMPTY, cache.readToken());
      // THEN the entry exists
      expect(cache.get(DOC_ID)).toEqual(VisitStats.EMPTY);
    });
  });

  describe('setIfNoWriteSince', () => {
    it('should cache the stats when no write happened since the token', () => {
      expect(cacheWithEntry().get(DOC_ID)).toEqual(DISK_STATS);
    });

    it('should accept when only OTHER docs were written since the token', () => {
      // GIVEN a token, then a full session write on another doc
      const cache = new VisitStatsCache();
      const token = cache.readToken();
      cache.beginSessionWrite(OTHER_DOC_ID);
      cache.endSessionWrite(OTHER_DOC_ID, 5000, 10);
      // WHEN this doc's read result is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token)).toBe(true);
    });

    it('should accept when the doc was written BEFORE the token', () => {
      // GIVEN a completed write, then a token
      const cache = new VisitStatsCache();
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 5000, 10);
      const token = cache.readToken();
      // WHEN the read result is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token)).toBe(true);
    });

    it('should reject when a write began after the token (still in flight)', () => {
      // GIVEN a token, then a write begins on the doc
      const cache = new VisitStatsCache();
      const token = cache.readToken();
      cache.beginSessionWrite(DOC_ID);
      // WHEN the read result is offered
      cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token);
      // THEN nothing is cached
      expect(cache.get(DOC_ID)).toBeUndefined();
    });

    it('should reject when a write began and ended after the token', () => {
      // GIVEN a token, then a whole session write on the doc
      const cache = new VisitStatsCache();
      const token = cache.readToken();
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 5000, 10);
      // WHEN the (possibly pre-append) read result is offered
      cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token);
      // THEN nothing is cached
      expect(cache.get(DOC_ID)).toBeUndefined();
    });

    it('should reject when the token was taken INSIDE the write window (read may include the append)', () => {
      // GIVEN a write in flight, then a token, then the read result arrives before the write ends
      const cache = new VisitStatsCache();
      cache.beginSessionWrite(DOC_ID);
      const token = cache.readToken();
      // WHEN the read result is offered
      // THEN it is rejected — caching it would double-count at endSessionWrite
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token)).toBe(false);
    });

    it('should reject while a second overlapping write on the doc is still in flight', () => {
      // GIVEN two overlapping writes on the doc, the first of which has ended
      const cache = new VisitStatsCache();
      cache.beginSessionWrite(DOC_ID);
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 5000, 10);
      // WHEN a read taken after that end is offered
      // THEN it is rejected — the second write's append may or may not be in it
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, cache.readToken())).toBe(false);
    });
  });

  describe('endSessionWrite', () => {
    it('should merge the session into a present entry', () => {
      // GIVEN cached stats
      const cache = cacheWithEntry();
      // WHEN a newer session is written through
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 2000, 50);
      // THEN last visit and total both reflect it
      expect(cache.get(DOC_ID)).toEqual({ lastVisitMs: 2000, totalFocusMs: 350 });
    });

    it('should NOT create an entry on a cache miss', () => {
      // GIVEN an empty cache
      const cache = new VisitStatsCache();
      // WHEN a session is written through
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 2000, 50);
      // THEN no one-session total is invented
      expect(cache.get(DOC_ID)).toBeUndefined();
    });

    it('should leave other docs untouched', () => {
      // GIVEN cached stats for DOC_ID
      const cache = cacheWithEntry();
      // WHEN another doc's session is written through
      cache.beginSessionWrite(OTHER_DOC_ID);
      cache.endSessionWrite(OTHER_DOC_ID, 2000, 50);
      // THEN DOC_ID keeps its stats
      expect(cache.get(DOC_ID)).toEqual(DISK_STATS);
    });

    it('should accept reads again once the window closed and a fresh token is taken', () => {
      // GIVEN a completed write window
      const cache = new VisitStatsCache();
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 2000, 50);
      // WHEN a fresh read result is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, cache.readToken())).toBe(true);
    });
  });

  describe('abortSessionWrite', () => {
    it('should delete the present entry', () => {
      // GIVEN cached stats
      const cache = cacheWithEntry();
      // WHEN a session write fails
      cache.beginSessionWrite(DOC_ID);
      cache.abortSessionWrite(DOC_ID);
      // THEN the entry is gone (next lookup re-reads disk)
      expect(cache.get(DOC_ID)).toBeUndefined();
    });

    it('should reject a read whose token predates the failed write', () => {
      // GIVEN a token, then a failed session write
      const cache = new VisitStatsCache();
      const token = cache.readToken();
      cache.beginSessionWrite(DOC_ID);
      cache.abortSessionWrite(DOC_ID);
      // WHEN the in-flight read result is offered
      // THEN it is rejected (the append may have partially landed)
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token)).toBe(false);
    });

    it('should close the write window so fresh reads are cached again', () => {
      // GIVEN a failed session write
      const cache = new VisitStatsCache();
      cache.beginSessionWrite(DOC_ID);
      cache.abortSessionWrite(DOC_ID);
      // WHEN a fresh read result is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, cache.readToken())).toBe(true);
    });
  });

  describe('beginHistoryMove / endHistoryMove', () => {
    it('should drop the cached entry once the move ends (next lookup re-reads disk)', () => {
      // GIVEN a cached entry
      const cache = cacheWithEntry();
      // WHEN history files are moved for the doc
      cache.beginHistoryMove(DOC_ID);
      cache.endHistoryMove(DOC_ID);
      // THEN the entry is gone
      expect(cache.get(DOC_ID)).toBeUndefined();
    });

    it('should reject a read that overlapped the move', () => {
      // GIVEN a token taken before a move ran
      const cache = new VisitStatsCache();
      const token = cache.readToken();
      cache.beginHistoryMove(DOC_ID);
      cache.endHistoryMove(DOC_ID);
      // WHEN the stale read result is offered
      // THEN it is rejected
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token)).toBe(false);
    });

    it('should reject a read finishing while the move is still in flight', () => {
      // GIVEN a move in progress
      const cache = new VisitStatsCache();
      cache.beginHistoryMove(DOC_ID);
      // WHEN a fresh read result is offered mid-move
      // THEN it is rejected
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, cache.readToken())).toBe(false);
    });

    it('should cache fresh reads again after the move ended', () => {
      // GIVEN a finished move
      const cache = new VisitStatsCache();
      cache.beginHistoryMove(DOC_ID);
      cache.endHistoryMove(DOC_ID);
      // WHEN a read started after the move is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, cache.readToken())).toBe(true);
    });
  });

  describe('write-mark eviction ceiling', () => {
    it('should reject a read when the doc mark may have been evicted by >= MAX_ENTRIES newer marks', () => {
      // GIVEN a token, a write on DOC_ID, then enough writes on other docs to evict its mark
      const cache = new VisitStatsCache();
      const token = cache.readToken();
      cache.beginSessionWrite(DOC_ID);
      cache.endSessionWrite(DOC_ID, 1, 1);
      for (let i = 0; i < VisitStatsCache.MAX_ENTRIES; i++) {
        cache.beginSessionWrite(`docid_${i}_E`);
        cache.endSessionWrite(`docid_${i}_E`, 1, 1);
      }
      // WHEN the stale read result is offered
      // THEN it is still rejected
      expect(cache.setIfNoWriteSince(DOC_ID, DISK_STATS, token)).toBe(false);
    });
  });
});
