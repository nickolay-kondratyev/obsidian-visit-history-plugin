import { describe, expect, it } from 'vitest';
import { MarkdownLinkSyntax } from './MarkdownLinkSyntax';

describe('MarkdownLinkSyntax', () => {
  describe('parse', () => {
    it('should parse a plain wikilink as a whole-note regular link', () => {
      expect(MarkdownLinkSyntax.parse('[[note2]]'))
        .toEqual({ isEmbed: false, linkpath: 'note2', subpath: '', alias: undefined });
    });

    it('should read the alias of a wikilink', () => {
      expect(MarkdownLinkSyntax.parse('[[note2|the details]]')?.alias).toBe('the details');
    });

    it('should mark a wikilink embed', () => {
      expect(MarkdownLinkSyntax.parse('![[note2]]')?.isEmbed).toBe(true);
    });

    it('should split a heading subpath off the link path', () => {
      expect(MarkdownLinkSyntax.parse('[[folder/note2#Some heading]]'))
        .toEqual({ isEmbed: false, linkpath: 'folder/note2', subpath: '#Some heading', alias: undefined });
    });

    it('should keep a block subpath', () => {
      expect(MarkdownLinkSyntax.parse('![[note2#^abc123]]')?.subpath).toBe('#^abc123');
    });

    it('should parse a markdown link with its text as alias', () => {
      expect(MarkdownLinkSyntax.parse('[see here](note2.md)'))
        .toEqual({ isEmbed: false, linkpath: 'note2.md', subpath: '', alias: 'see here' });
    });

    it('should URL-decode a markdown link target', () => {
      expect(MarkdownLinkSyntax.parse('[x](my%20note.md)')?.linkpath).toBe('my note.md');
    });

    it('should treat an empty wikilink alias as no alias', () => {
      expect(MarkdownLinkSyntax.parse('[[note2|]]')?.alias).toBeUndefined();
    });

    it('should return null for text that is not exactly one link', () => {
      expect(MarkdownLinkSyntax.parse('see [[note2]]')).toBeNull();
    });

    it('should return null for an external markdown link', () => {
      expect(MarkdownLinkSyntax.parse('[site](https://example.com)')).toBeNull();
    });
  });

  describe('findAllLinks', () => {
    it('should find wikilinks and markdown links in text order', () => {
      // GIVEN a canvas text card mixing link styles
      const text = 'First [md](b.md) then [[a]] and ![[c#^x]]';
      // WHEN scanned
      // THEN all three are found in order
      expect(MarkdownLinkSyntax.findAllLinks(text).map(link => link.linkpath)).toEqual(['b.md', 'a', 'c']);
    });

    it('should skip external links', () => {
      expect(MarkdownLinkSyntax.findAllLinks('[a](https://x.y) [b](mailto:a@b.c)')).toEqual([]);
    });

    it('should find nothing in plain text', () => {
      expect(MarkdownLinkSyntax.findAllLinks('no links here')).toEqual([]);
    });
  });
});
