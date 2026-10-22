import { describe, expect, it } from 'vitest';
import { SelfLinkRewrite, SelfLinkRewriter, SelfLinkSite } from './SelfLinkRewriter';

/** Self-link sites of the given originals, each at its first occurrence in `content`. */
function sitesIn(content: string, originals: { original: string; subpath: string }[]): SelfLinkSite[] {
  return originals.map(({ original, subpath }) => {
    const startOffset = content.indexOf(original);
    if (startOffset < 0) throw new Error(`link not found original=[${original}]`);
    return { startOffset, endOffset: startOffset + original.length, original, isEmbed: original.startsWith('!'), subpath };
  });
}

function rewrite(content: string, originals: { original: string; subpath: string }[]): SelfLinkRewrite {
  const result = SelfLinkRewriter.rewrite(content, sitesIn(content, originals));
  if (result === null) throw new Error('expected a rewrite, got null');
  return result;
}

describe('SelfLinkRewriter', () => {
  describe('rewrite — links to a part of the note', () => {
    it('should turn a heading self-link into a same-note link keeping its alias', () => {
      expect(rewrite('See [[note2#Part|the part]].', [{ original: '[[note2#Part|the part]]', subpath: '#Part' }]).content)
        .toBe('See [[#Part|the part]].');
    });

    it('should turn a block self-link into a same-note block link', () => {
      expect(rewrite('See [[note2#^b1]].', [{ original: '[[note2#^b1]]', subpath: '#^b1' }]).content)
        .toBe('See [[#^b1]].');
    });

    it('should keep an embed an embed', () => {
      expect(rewrite('![[note2#Part]]', [{ original: '![[note2#Part]]', subpath: '#Part' }]).content).toBe('![[#Part]]');
    });

    it('should drop a folder path from the link target', () => {
      expect(rewrite('[[sub/note2#Part]]', [{ original: '[[sub/note2#Part]]', subpath: '#Part' }]).content).toBe('[[#Part]]');
    });

    it('should keep an escaped table pipe', () => {
      expect(rewrite('| [[note2#Part\\|p]] |', [{ original: '[[note2#Part\\|p]]', subpath: '#Part' }]).content)
        .toBe('| [[#Part\\|p]] |');
    });

    it('should turn a markdown self-link into a same-note markdown link', () => {
      expect(rewrite('[C# part](note2.md#Part%20one)', [{ original: '[C# part](note2.md#Part%20one)', subpath: '#Part one' }]).content)
        .toBe('[C# part](#Part%20one)');
    });

    it('should leave a link that is already same-note as it is', () => {
      expect(rewrite('[[#Part]]', [{ original: '[[#Part]]', subpath: '#Part' }]).content).toBe('[[#Part]]');
    });
  });

  describe('rewrite — whole-note self-links', () => {
    it('should leave a whole-note self-link in the text', () => {
      expect(rewrite('See [[note2]].', [{ original: '[[note2]]', subpath: '' }]).content).toBe('See [[note2]].');
    });

    it('should report a whole-note self-link with its alias', () => {
      expect(rewrite('See [[note2|n2]].', [{ original: '[[note2|n2]]', subpath: '' }]).wholeNoteLinks).toEqual([
        { startOffset: 4, endOffset: 16, isEmbed: false, alias: 'n2' },
      ]);
    });

    it('should report a whole-note self-link at its offset AFTER earlier rewrites', () => {
      // GIVEN a part link (which gets shorter) before a whole-note link on the same line
      const content = 'A [[note2#Part]] B [[note2]]';
      // WHEN rewritten
      const result = rewrite(content, [{ original: '[[note2#Part]]', subpath: '#Part' }, { original: '[[note2]]', subpath: '' }]);
      // THEN the whole-note link's offset points at it in the rewritten text
      expect(result.wholeNoteLinks[0]?.startOffset).toBe(result.content.indexOf('[[note2]]'));
    });
  });

  describe('rewrite — stale index', () => {
    it('should return null when a self-link is no longer at its offsets', () => {
      const stale: SelfLinkSite = { startOffset: 0, endOffset: 9, original: '[[note2]]', isEmbed: false, subpath: '' };
      expect(SelfLinkRewriter.rewrite('Changed [[note2]]', [stale])).toBeNull();
    });
  });
});
