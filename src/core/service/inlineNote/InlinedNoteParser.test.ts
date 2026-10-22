import { describe, expect, it } from 'vitest';
import { InlinedNoteParser } from './InlinedNoteParser';

const NOTE2 = [
  '---',
  'id: docid_note2_e',
  'title: Note two',
  'tags:',
  '  - "#project"',
  '  - area/home',
  'aliases: [N2, Second]',
  'locations:',
  'status: draft',
  'source: "https://example.com"',
  '---',
  '',
  '# Note two',
  '',
  'Body text.',
  '## Part',
  'More.',
  '',
].join('\n');

describe('InlinedNoteParser', () => {
  describe('parse', () => {
    it('should use the frontmatter title', () => {
      expect(InlinedNoteParser.parse(NOTE2, 'note2').title).toBe('Note two');
    });

    it('should keep only the other properties in the yaml block, verbatim', () => {
      // GIVEN note2 with id, title, tags, aliases, a flag key and other properties
      // WHEN parsed
      // THEN aliases + other properties remain, in original order and formatting
      expect(InlinedNoteParser.parse(NOTE2, 'note2').propertyLines)
        .toEqual(['aliases: [N2, Second]', 'status: draft', 'source: "https://example.com"']);
    });

    it('should collect tags without leading hashes', () => {
      expect(InlinedNoteParser.parse(NOTE2, 'note2').frontmatterAdditions.tags).toEqual(['project', 'area/home']);
    });

    it('should collect aliases for merging', () => {
      expect(InlinedNoteParser.parse(NOTE2, 'note2').frontmatterAdditions.aliases).toEqual(['N2', 'Second']);
    });

    it('should collect empty-value keys as flag keys', () => {
      expect(InlinedNoteParser.parse(NOTE2, 'note2').frontmatterAdditions.flagKeys).toEqual(['locations']);
    });

    it('should drop a leading H1 equal to the title', () => {
      expect(InlinedNoteParser.parse(NOTE2, 'note2').bodyLines).toEqual(['Body text.', '## Part', 'More.']);
    });

    it('should keep a leading H1 that differs from the title', () => {
      // GIVEN a frontmatter title different from the body H1
      const content = '---\ntitle: Other\n---\n# Body H1\ntext';
      // WHEN parsed
      // THEN the H1 stays
      expect(InlinedNoteParser.parse(content, 'note2').bodyLines).toEqual(['# Body H1', 'text']);
    });

    it('should drop the H1 the title was taken from when it starts the body', () => {
      expect(InlinedNoteParser.parse('# Heading title\ntext', 'note2').bodyLines).toEqual(['text']);
    });

    it('should keep an H1 that is not at the start of the body', () => {
      expect(InlinedNoteParser.parse('intro\n# Heading title', 'note2').bodyLines).toEqual(['intro', '# Heading title']);
    });

    it('should handle a note without frontmatter', () => {
      expect(InlinedNoteParser.parse('plain', 'note2').propertyLines).toEqual([]);
    });

    it('should fall back to the file name as title', () => {
      expect(InlinedNoteParser.parse('plain', 'note2').title).toBe('note2');
    });

    it('should not report an empty tags key as a flag key', () => {
      expect(InlinedNoteParser.parse('---\ntags:\n---\nx', 'note2').frontmatterAdditions.flagKeys).toEqual([]);
    });
  });
});
