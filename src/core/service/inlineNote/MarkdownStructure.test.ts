import { describe, expect, it } from 'vitest';
import { MarkdownStructure } from './MarkdownStructure';

describe('MarkdownStructure', () => {
  describe('parseHeading', () => {
    it('should read level and text', () => {
      expect(MarkdownStructure.parseHeading('### Third')).toEqual({ level: 3, text: 'Third' });
    });

    it('should strip closing hashes', () => {
      expect(MarkdownStructure.parseHeading('## Title ##')).toEqual({ level: 2, text: 'Title' });
    });

    it('should not treat a tag as a heading', () => {
      expect(MarkdownStructure.parseHeading('#tag text')).toBeNull();
    });

    it('should not treat seven hashes as a heading', () => {
      expect(MarkdownStructure.parseHeading('####### deep')).toBeNull();
    });

    it('should accept an empty heading', () => {
      expect(MarkdownStructure.parseHeading('##')).toEqual({ level: 2, text: '' });
    });
  });

  describe('headings', () => {
    it('should skip headings inside fenced code', () => {
      // GIVEN a bash comment inside a fence between two real headings
      const lines = ['# A', '```bash', '# not a heading', '```', '## B'];
      // WHEN headings are listed
      // THEN only the real ones are found
      expect(MarkdownStructure.headings(lines).map(heading => heading.text)).toEqual(['A', 'B']);
    });

    it('should keep a longer fence open past a shorter inner fence', () => {
      const lines = ['````', '```', '# inside', '```', '````', '# after'];
      expect(MarkdownStructure.headings(lines).map(heading => heading.text)).toEqual(['after']);
    });

    it('should not close a backtick fence with tildes', () => {
      const lines = ['```', '~~~', '# inside', '```', '# after'];
      expect(MarkdownStructure.headings(lines).map(heading => heading.text)).toEqual(['after']);
    });

    it('should start from the given line', () => {
      expect(MarkdownStructure.headings(['# A', '# B'], 1).map(heading => heading.lineIndex)).toEqual([1]);
    });
  });

  describe('shiftHeadings', () => {
    it('should move headings deeper keeping relative depth', () => {
      expect(MarkdownStructure.shiftHeadings(['# A', 'text', '## B'], 3)).toEqual(['#### A', 'text', '##### B']);
    });

    it('should not shift comment lines inside code', () => {
      expect(MarkdownStructure.shiftHeadings(['```', '# comment', '```'], 2)).toEqual(['```', '# comment', '```']);
    });
  });

  describe('trimBlankLines', () => {
    it('should drop leading and trailing blank lines only', () => {
      expect(MarkdownStructure.trimBlankLines(['', 'a', '', 'b', ' ', ''])).toEqual(['a', '', 'b']);
    });
  });
});
