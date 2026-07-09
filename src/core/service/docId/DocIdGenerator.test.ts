import { describe, expect, it } from 'vitest';
import { DocIdGeneratorDefault } from './DocIdGenerator';

describe('DocIdGeneratorDefault', () => {
  describe('generate', () => {
    it('should produce ids matching docid_{21 base62}_E', () => {
      // GIVEN
      const generator = new DocIdGeneratorDefault();
      // WHEN
      const id = generator.generate();
      // THEN
      expect(id).toMatch(/^docid_[0-9A-Za-z]{21}_E$/);
    });

    it('should produce unique ids across many calls', () => {
      // GIVEN
      const generator = new DocIdGeneratorDefault();
      const CALLS = 1000;
      // WHEN
      const ids = new Set(Array.from({ length: CALLS }, () => generator.generate()));
      // THEN
      expect(ids.size).toBe(CALLS);
    });
  });
});
