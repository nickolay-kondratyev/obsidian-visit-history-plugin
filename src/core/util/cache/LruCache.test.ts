import { describe, expect, it } from 'vitest';
import { LruCache } from './LruCache';

describe('LruCache', () => {
  describe('constructor', () => {
    it('should throw when maxEntries is zero', () => {
      expect(() => new LruCache<string, number>(0)).toThrow();
    });

    it('should throw when maxEntries is negative', () => {
      expect(() => new LruCache<string, number>(-1)).toThrow();
    });

    it('should throw when maxEntries is not an integer', () => {
      expect(() => new LruCache<string, number>(1.5)).toThrow();
    });
  });

  describe('get', () => {
    it('should return undefined on a miss', () => {
      // GIVEN an empty cache
      const cache = new LruCache<string, number>(2);
      // WHEN reading an absent key THEN it misses
      expect(cache.get('absent')).toBeUndefined();
    });

    it('should return the stored value on a hit', () => {
      // GIVEN a cached entry
      const cache = new LruCache<string, number>(2);
      cache.set('a', 1);
      // WHEN reading it THEN the value comes back
      expect(cache.get('a')).toBe(1);
    });

    it('should return a stored null value (null is cacheable)', () => {
      // GIVEN a cached null (e.g. a "never visited" result)
      const cache = new LruCache<string, number | null>(2);
      cache.set('a', null);
      // WHEN reading it THEN null (not undefined) comes back
      expect(cache.get('a')).toBeNull();
    });

    it('should mark the key most recently used, protecting it from eviction', () => {
      // GIVEN a full cache where 'a' is oldest
      const cache = new LruCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      // WHEN 'a' is read (refreshed) and a new key evicts one entry
      cache.get('a');
      cache.set('c', 3);
      // THEN 'b' (now least recently used) was evicted, 'a' survives
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should overwrite an existing key without growing the cache', () => {
      // GIVEN a cached entry
      const cache = new LruCache<string, number>(2);
      cache.set('a', 1);
      // WHEN the same key is set again
      cache.set('a', 2);
      // THEN the value is replaced and size is unchanged
      expect(cache.get('a')).toBe(2);
      expect(cache.size).toBe(1);
    });

    it('should evict the least recently used entry when full', () => {
      // GIVEN a full cache where 'a' is least recently used
      const cache = new LruCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      // WHEN a new key is inserted
      cache.set('c', 3);
      // THEN 'a' was evicted, the rest remain
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('should treat overwriting an existing key as use (not eviction pressure)', () => {
      // GIVEN a full cache
      const cache = new LruCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      // WHEN an existing key is overwritten
      cache.set('a', 10);
      // THEN nothing was evicted
      expect(cache.get('b')).toBe(2);
      expect(cache.size).toBe(2);
    });

    it('should never exceed maxEntries', () => {
      // GIVEN a small cache
      const cache = new LruCache<number, number>(3);
      // WHEN many entries are inserted
      for (let i = 0; i < 100; i++) {
        cache.set(i, i);
      }
      // THEN size stays bounded
      expect(cache.size).toBe(3);
    });

    it('should support a cache of size one', () => {
      // GIVEN a single-slot cache
      const cache = new LruCache<string, number>(1);
      cache.set('a', 1);
      // WHEN a second key is inserted
      cache.set('b', 2);
      // THEN only the newest survives
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
    });

    it('should throw when storing undefined (indistinguishable from a miss)', () => {
      // GIVEN a cache whose value type admits undefined
      const cache = new LruCache<string, number | undefined>(2);
      // WHEN storing undefined THEN it is rejected — a silent store would
      // occupy a slot that get() forever reports as a miss
      expect(() => cache.set('a', undefined)).toThrow();
    });
  });
});
