import { describe, expect, it } from 'vitest';
import { FrontmatterMerger } from './FrontmatterMerger';
import { FrontmatterAdditions } from './InlinedNoteParser';

const NOTHING: FrontmatterAdditions = { tags: [], aliases: [], flagKeys: [] };

function merge(content: string, additions: Partial<FrontmatterAdditions>): string {
  return FrontmatterMerger.merge(content, { ...NOTHING, ...additions });
}

describe('FrontmatterMerger', () => {
  describe('merge', () => {
    it('should return the content unchanged when nothing is added', () => {
      const content = '---\nid: x\nrating:  "5"\n---\nbody';
      expect(merge(content, {})).toBe(content);
    });

    it('should return the content unchanged when every tag is already present', () => {
      // GIVEN note1 with the tag written differently (#, case)
      const content = '---\ntags: [Project]\n---\nbody';
      // WHEN the same tag is added
      // THEN nothing changes
      expect(merge(content, { tags: ['#project'] })).toBe(content);
    });

    it('should append new tags to a block list keeping its indent', () => {
      expect(merge('---\ntags:\n    - a\nother: 1\n---\nbody', { tags: ['b'] }))
        .toBe('---\ntags:\n    - a\n    - b\nother: 1\n---\nbody');
    });

    it('should keep a CRLF note CRLF when adding to a block list', () => {
      expect(merge('---\r\ntags:\r\n  - a\r\n---\r\nbody', { tags: ['b'] }))
        .toBe('---\r\ntags:\r\n  - a\r\n  - b\r\n---\r\nbody');
    });

    it('should add a CRLF frontmatter block to a CRLF note without one', () => {
      expect(merge('body\r\nmore', { tags: ['b'] })).toBe('---\r\ntags:\r\n  - b\r\n---\r\nbody\r\nmore');
    });

    it('should add new tags into a flow list', () => {
      expect(merge('---\ntags: [a, "b"]\n---\nbody', { tags: ['c'] }))
        .toBe('---\ntags: [a, "b", c]\n---\nbody');
    });

    it('should add into an empty flow list', () => {
      expect(merge('---\ntags: []\n---\nbody', { tags: ['c'] })).toBe('---\ntags: [c]\n---\nbody');
    });

    it('should turn a scalar alias into a list holding old and new aliases', () => {
      expect(merge('---\naliases: Old name\n---\nbody', { aliases: ['New'] }))
        .toBe('---\naliases:\n  - Old name\n  - New\n---\nbody');
    });

    it('should fill an empty tags key', () => {
      expect(merge('---\ntags:\nx: 1\n---\nbody', { tags: ['a'] })).toBe('---\ntags:\n  - a\nx: 1\n---\nbody');
    });

    it('should add a missing tags key at the end of the frontmatter', () => {
      expect(merge('---\nid: x\n---\nbody', { tags: ['a'] })).toBe('---\nid: x\ntags:\n  - a\n---\nbody');
    });

    it('should not add an alias twice', () => {
      expect(merge('---\naliases: [A]\n---\nbody', { aliases: ['A', 'B', 'B'] })).toBe('---\naliases: [A, B]\n---\nbody');
    });

    it('should treat aliases case-sensitively', () => {
      expect(merge('---\naliases: [a]\n---\nbody', { aliases: ['A'] })).toBe('---\naliases: [a, A]\n---\nbody');
    });

    it('should quote added values that YAML would misread', () => {
      expect(merge('---\naliases: [A]\n---\nbody', { aliases: ['Note: two'] }))
        .toBe('---\naliases: [A, "Note: two"]\n---\nbody');
    });

    it('should add a missing flag key', () => {
      expect(merge('---\nid: x\n---\nbody', { flagKeys: ['locations'] })).toBe('---\nid: x\nlocations:\n---\nbody');
    });

    it('should not touch a flag key note1 already has (any value)', () => {
      const content = '---\nlocations: home\n---\nbody';
      expect(merge(content, { flagKeys: ['locations'] })).toBe(content);
    });

    it('should create a frontmatter block when note1 has none', () => {
      expect(merge('body', { tags: ['a'] })).toBe('---\ntags:\n  - a\n---\nbody');
    });

    it('should keep lines of other keys byte-identical', () => {
      // GIVEN quoted/odd formatting on keys we don't own
      const content = "---\nrating:  '5'   \ncreated: \"2026-01-01\"\n---\nbody";
      // WHEN a tag is added
      const merged = merge(content, { tags: ['a'] });
      // THEN those lines are untouched
      expect(merged).toBe("---\nrating:  '5'   \ncreated: \"2026-01-01\"\ntags:\n  - a\n---\nbody");
    });
  });
});
