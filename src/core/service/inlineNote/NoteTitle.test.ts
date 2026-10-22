import { describe, expect, it } from 'vitest';
import { NoteTitle } from './NoteTitle';

describe('NoteTitle', () => {
  describe('resolve', () => {
    it('should prefer the frontmatter title', () => {
      expect(NoteTitle.resolve('---\ntitle: "From props"\n---\n# From H1', 'file-name')).toBe('From props');
    });

    it('should fall back to the first H1', () => {
      expect(NoteTitle.resolve('intro\n## Sub\n# From H1\n# Second H1', 'file-name')).toBe('From H1');
    });

    it('should ignore an H1 inside fenced code', () => {
      expect(NoteTitle.resolve('```\n# comment\n```', 'file-name')).toBe('file-name');
    });

    it('should fall back to the file name', () => {
      expect(NoteTitle.resolve('just text', 'file-name')).toBe('file-name');
    });

    it('should skip an empty frontmatter title', () => {
      expect(NoteTitle.resolve('---\ntitle:\n---\n# From H1', 'file-name')).toBe('From H1');
    });
  });
});
