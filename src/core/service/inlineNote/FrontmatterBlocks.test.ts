import { describe, expect, it } from 'vitest';
import { FrontmatterBlock, FrontmatterBlocks } from './FrontmatterBlocks';

function blocksOf(...frontmatterLines: string[]): FrontmatterBlock[] {
  return FrontmatterBlocks.parseBlocks(frontmatterLines).blocks;
}

function onlyBlock(...frontmatterLines: string[]): FrontmatterBlock {
  const [block] = blocksOf(...frontmatterLines);
  if (block === undefined) throw new Error('expected a block');
  return block;
}

describe('FrontmatterBlocks', () => {
  describe('split', () => {
    it('should find the closing fence of a frontmatter block', () => {
      expect(FrontmatterBlocks.split('---\na: 1\n---\nbody').closingFenceIndex).toBe(2);
    });

    it('should report no frontmatter when the note does not start with a fence', () => {
      expect(FrontmatterBlocks.split('body\n---\na: 1\n---').closingFenceIndex).toBeNull();
    });

    it('should report no frontmatter when the fence is never closed', () => {
      expect(FrontmatterBlocks.split('---\na: 1\nbody').closingFenceIndex).toBeNull();
    });

    it('should accept CRLF fences', () => {
      expect(FrontmatterBlocks.split('---\r\na: 1\r\n---\r\nbody').closingFenceIndex).toBe(2);
    });
  });

  describe('bodyLines', () => {
    it('should return the lines after the closing fence', () => {
      expect(FrontmatterBlocks.bodyLines(FrontmatterBlocks.split('---\na: 1\n---\nline 1\nline 2')))
        .toEqual(['line 1', 'line 2']);
    });
  });

  describe('parseBlocks', () => {
    it('should split top-level keys into blocks with their continuation lines', () => {
      expect(blocksOf('a: 1', 'tags:', '  - x', 'b: 2').map(block => block.lines))
        .toEqual([['a: 1'], ['tags:', '  - x'], ['b: 2']]);
    });

    it('should accept an unindented block sequence under its key', () => {
      expect(blocksOf('tags:', '- x', '- y')).toHaveLength(1);
    });

    it('should read a quoted key without its quotes', () => {
      expect(onlyBlock('"my key": v').key).toBe('my key');
    });

    it('should keep lines before the first key as preamble', () => {
      expect(FrontmatterBlocks.parseBlocks(['# comment', 'a: 1']).preambleLines).toEqual(['# comment']);
    });

    it('should not treat a URL value colon as a second key', () => {
      expect(onlyBlock('source: https://example.com/x').inlineValue).toBe('https://example.com/x');
    });
  });

  describe('isEmptyValue', () => {
    it('should be true for a bare key (tag property flag)', () => {
      expect(FrontmatterBlocks.isEmptyValue(onlyBlock('locations:'))).toBe(true);
    });

    it('should be false for a key with an inline value', () => {
      expect(FrontmatterBlocks.isEmptyValue(onlyBlock('locations: home'))).toBe(false);
    });

    it('should be false for a key with list items', () => {
      expect(FrontmatterBlocks.isEmptyValue(onlyBlock('locations:', '  - home'))).toBe(false);
    });
  });

  describe('listValues', () => {
    it('should read a block sequence', () => {
      expect(FrontmatterBlocks.listValues(onlyBlock('tags:', '  - a', '  - "b c"'))).toEqual(['a', 'b c']);
    });

    it('should read a flow list', () => {
      expect(FrontmatterBlocks.listValues(onlyBlock('tags: [a, "b", \'c\']'))).toEqual(['a', 'b', 'c']);
    });

    it('should split a plain comma-separated scalar', () => {
      expect(FrontmatterBlocks.listValues(onlyBlock('tags: a, b'))).toEqual(['a', 'b']);
    });

    it('should keep a quoted scalar whole', () => {
      expect(FrontmatterBlocks.listValues(onlyBlock('aliases: "Hello, world"'))).toEqual(['Hello, world']);
    });

    it('should return [] for an empty value', () => {
      expect(FrontmatterBlocks.listValues(onlyBlock('tags:'))).toEqual([]);
    });

    it('should return [] for an empty flow list', () => {
      expect(FrontmatterBlocks.listValues(onlyBlock('tags: []'))).toEqual([]);
    });
  });

  describe('unquote', () => {
    it('should unescape a single-quoted value', () => {
      expect(FrontmatterBlocks.unquote("'it''s'")).toBe("it's");
    });

    it('should decode escapes in a double-quoted value', () => {
      expect(FrontmatterBlocks.unquote('"a\\"b"')).toBe('a"b');
    });
  });

  describe('yamlScalar', () => {
    it('should keep a simple value plain', () => {
      expect(FrontmatterBlocks.yamlScalar('area/work-stuff')).toBe('area/work-stuff');
    });

    it('should quote a value with a colon', () => {
      expect(FrontmatterBlocks.yamlScalar('a: b')).toBe('"a: b"');
    });

    it('should quote a value starting with a YAML indicator', () => {
      expect(FrontmatterBlocks.yamlScalar('-dash')).toBe('"-dash"');
    });
  });
});
