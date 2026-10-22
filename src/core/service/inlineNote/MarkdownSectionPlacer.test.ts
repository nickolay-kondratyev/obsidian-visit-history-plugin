import { describe, expect, it } from 'vitest';
import { InlineLinkSite, MarkdownSectionPlacer, PlacementResult } from './MarkdownSectionPlacer';
import { InlinedNote } from './InlinedNoteParser';

const NOTE1_TITLE = 'Note one';

function inlinedNote(overrides: Partial<InlinedNote> = {}): InlinedNote {
  return {
    title: 'note2',
    propertyLines: [],
    bodyLines: ['note2 body'],
    frontmatterAdditions: { tags: [], aliases: [], flagKeys: [] },
    ...overrides,
  };
}

/** The link site of the FIRST occurrence of `original` in the content. */
function siteOf(content: string, original: string): InlineLinkSite {
  const startOffset = content.indexOf(original);
  if (startOffset < 0) throw new Error(`link not found original=[${original}]`);
  return { startOffset, endOffset: startOffset + original.length, original, isEmbed: original.startsWith('!') };
}

function place(lines: string[], original: string, inlined: InlinedNote = inlinedNote()): PlacementResult {
  const content = lines.join('\n');
  return MarkdownSectionPlacer.place(content, NOTE1_TITLE, siteOf(content, original), inlined);
}

function placedLines(lines: string[], original: string, inlined: InlinedNote = inlinedNote()): string[] {
  const result = place(lines, original, inlined);
  if (result.kind !== 'placed') throw new Error(`expected placed, got kind=[${result.kind}]`);
  return result.content.split('\n');
}

describe('MarkdownSectionPlacer', () => {
  describe('place — plain paragraph link', () => {
    it('should insert the section right after the link line, one level below the enclosing heading', () => {
      // GIVEN a regular link under ### Third, followed by another section
      const lines = ['### Third', 'See [[note2]] for details.', '## Next'];
      // WHEN placed
      // THEN the link becomes plain text and the titled section follows it
      expect(placedLines(lines, '[[note2]]')).toEqual([
        '### Third', 'See note2 for details.', '#### note2', 'note2 body', '## Next',
      ]);
    });

    it('should use the alias as plain text', () => {
      expect(placedLines(['# A', 'See [[note2|the details]].'], '[[note2|the details]]')[1]).toBe('See the details.');
    });

    it('should use the alias text of a markdown link', () => {
      expect(placedLines(['# A', 'See [here](note2.md).'], '[here](note2.md)')[1]).toBe('See here.');
    });

    it('should drop an embed line that is left empty', () => {
      expect(placedLines(['## A', '![[note2]]', '## B'], '![[note2]]')).toEqual(['## A', '### note2', 'note2 body', '## B']);
    });

    it('should remove an embed but keep the rest of its line', () => {
      expect(placedLines(['## A', 'Intro ![[note2]]', '## B'], '![[note2]]')[1]).toBe('Intro ');
    });

    it('should use ## for the title when the link is not under any heading', () => {
      expect(placedLines(['See [[note2]].'], '[[note2]]')[1]).toBe('## note2');
    });

    it('should use ## for the title under an H1', () => {
      expect(placedLines(['# Top', 'See [[note2]].'], '[[note2]]')[2]).toBe('## note2');
    });

    it('should ignore headings inside code when finding the enclosing section', () => {
      // GIVEN a bash comment in a fence between the real heading and the link
      const lines = ['## Real', '```', '##### comment', '```', 'See [[note2]].'];
      // WHEN placed
      // THEN the title sits under ## Real
      expect(placedLines(lines, '[[note2]]')[5]).toBe('### note2');
    });

    it('should keep the receiving note frontmatter untouched', () => {
      const lines = ['---', 'id: x', '---', '## A', 'See [[note2]].'];
      expect(placedLines(lines, '[[note2]]').slice(0, 3)).toEqual(['---', 'id: x', '---']);
    });
  });

  describe('place — line endings', () => {
    it('should keep a CRLF note CRLF throughout, inserted lines included', () => {
      // GIVEN a CRLF note1 whose last line has no line break
      const content = ['### Third', 'See [[note2]].', 'More.'].join('\r\n');
      // WHEN placed
      const result = MarkdownSectionPlacer.place(content, NOTE1_TITLE, siteOf(content, '[[note2]]'), inlinedNote());
      // THEN every line ends with CRLF
      expect(result.kind === 'placed' && result.content).toBe(
        ['### Third', 'See note2.', '#### note2', 'note2 body', '#### Third-continued', 'More.'].join('\r\n'),
      );
    });

    it('should not carry CR from the inlined body into an LF note', () => {
      const inlined = inlinedNote({ bodyLines: ['crlf body\r'] });
      expect(placedLines(['## A', 'See [[note2]].'], '[[note2]]', inlined)).toEqual(['## A', 'See note2.', '### note2', 'crlf body']);
    });
  });

  describe('place — inserted block', () => {
    it('should put leftover properties in a yaml block right under the title', () => {
      const inlined = inlinedNote({ propertyLines: ['status: draft'] });
      expect(placedLines(['## A', 'See [[note2]].'], '[[note2]]', inlined).slice(2)).toEqual([
        '### note2', '```yaml', 'status: draft', '```', 'note2 body',
      ]);
    });

    it('should shift body headings under the title keeping relative depth', () => {
      // GIVEN a body with # and ## headings, inlined under ### (title ####)
      const inlined = inlinedNote({ bodyLines: ['# Part', 'x', '## Sub'] });
      // WHEN placed
      // THEN they become ##### and ######
      expect(placedLines(['### Third', 'See [[note2]].'], '[[note2]]', inlined).slice(2)).toEqual([
        '#### note2', '##### Part', 'x', '###### Sub',
      ]);
    });

    it('should normalize body headings that start deeper than level 1', () => {
      const inlined = inlinedNote({ bodyLines: ['#### Part'] });
      expect(placedLines(['## A', 'See [[note2]].'], '[[note2]]', inlined)[3]).toBe('#### Part');
    });

    it('should not shift comment lines inside code in the body', () => {
      const inlined = inlinedNote({ bodyLines: ['```bash', '# comment', '```'] });
      expect(placedLines(['## A', 'See [[note2]].'], '[[note2]]', inlined)[4]).toBe('# comment');
    });
  });

  describe('place — continuation heading', () => {
    it('should add a -continued heading when loose text followed the link line', () => {
      // GIVEN more text of the section after the link line
      const lines = ['### Third', 'See [[note2]].', 'More text of Third.', '## Next'];
      // WHEN placed
      // THEN that text gets a continuation heading at the title level
      expect(placedLines(lines, '[[note2]]')).toEqual([
        '### Third', 'See note2.', '#### note2', 'note2 body', '#### Third-continued', 'More text of Third.', '## Next',
      ]);
    });

    it('should not add a continuation heading when only blank lines precede the next heading', () => {
      expect(placedLines(['### Third', 'See [[note2]].', '', '#### Sub'], '[[note2]]'))
        .not.toContain('#### Third-continued');
    });

    it('should not add a continuation heading at the end of the note', () => {
      expect(placedLines(['### Third', 'See [[note2]].', ''], '[[note2]]')).toEqual([
        '### Third', 'See note2.', '#### note2', 'note2 body', '',
      ]);
    });

    it('should name the continuation after the receiving note when no heading encloses the link', () => {
      expect(placedLines(['See [[note2]].', 'More.'], '[[note2]]')[3]).toBe('## Note one-continued');
    });

    it('should keep an existing sub-heading of the section as it is', () => {
      // GIVEN the link line directly followed by a sub-heading
      const lines = ['### Third', 'See [[note2]].', '#### Existing', 'text'];
      // WHEN placed
      // THEN no continuation is needed and the sub-heading follows the block
      expect(placedLines(lines, '[[note2]]').slice(4)).toEqual(['#### Existing', 'text']);
    });
  });

  describe('place — link inside a container', () => {
    it('should insert after the end of a list and turn the link into a heading link', () => {
      // GIVEN the link inside a list item, more items after it
      const lines = ['### Third', '- see [[note2]]', '- other item', '## Next'];
      // WHEN placed
      // THEN the list stays whole and its item points at the new section
      expect(placedLines(lines, '[[note2]]')).toEqual([
        '### Third', '- see [[#note2|note2]]', '- other item', '#### note2', 'note2 body', '## Next',
      ]);
    });

    it('should keep the alias as heading link display text', () => {
      expect(placedLines(['## A', '- see [[note2|details]]'], '[[note2|details]]')[1]).toBe('- see [[#note2|details]]');
    });

    it('should turn an embed in a list into a heading link too', () => {
      expect(placedLines(['## A', '- ![[note2]]'], '![[note2]]')[1]).toBe('- [[#note2|note2]]');
    });

    it('should treat an indented continuation line of a list item as part of the list', () => {
      const lines = ['## A', '- item', '  continued [[note2]]', '- last', 'After.'];
      expect(placedLines(lines, '[[note2]]').slice(3, 6)).toEqual(['- last', '### note2', 'note2 body']);
    });

    it('should keep a loose list (blank lines between items) whole', () => {
      const lines = ['## A', '- see [[note2]]', '', '- next item', '## B'];
      expect(placedLines(lines, '[[note2]]').slice(3, 5)).toEqual(['- next item', '### note2']);
    });

    it('should add the continuation heading for text after the list', () => {
      const lines = ['### Third', '- see [[note2]]', 'Text after the list.'];
      expect(placedLines(lines, '[[note2]]').slice(2)).toEqual([
        '#### note2', 'note2 body', '#### Third-continued', 'Text after the list.',
      ]);
    });

    it('should insert after the end of a callout', () => {
      const lines = ['## A', '> [!note]', '> see [[note2]]', '> more', 'After.'];
      expect(placedLines(lines, '[[note2]]').slice(3, 5)).toEqual(['> more', '### note2']);
    });

    it('should insert after the end of a table, escaping the heading link pipe', () => {
      // GIVEN the link inside a table cell
      const lines = ['## A', '| col |', '| --- |', '| [[note2]] |', '| x |'];
      // WHEN placed
      // THEN the pipe is escaped (a bare | would split the cell) and the block follows the table
      expect(placedLines(lines, '[[note2]]').slice(3, 6)).toEqual(['| [[#note2\\|note2]] |', '| x |', '### note2']);
    });

    it('should use the nested heading link form when note1 already has a heading with the title text', () => {
      // GIVEN an earlier heading with the same text as note2's title
      const lines = ['## note2', 'old', '## Third', '- see [[note2]]'];
      // WHEN placed
      // THEN the link targets the new section under its enclosing heading
      expect(placedLines(lines, '[[note2]]')[3]).toBe('- see [[#Third#note2|note2]]');
    });

    it('should strip characters a heading link cannot hold', () => {
      const inlined = inlinedNote({ title: 'A|B [x]' });
      expect(placedLines(['## A', '- [[note2]]'], '[[note2]]', inlined)[1]).toBe('- [[#A B x|A B x]]');
    });

    it('should strip the characters Obsidian strips from heading link targets (: \\ %%)', () => {
      // GIVEN a title holding characters Obsidian's stripHeadingForLink replaces
      const inlined = inlinedNote({ title: 'Q: a\\b %% c' });
      // WHEN placed inside a list
      // THEN the target is the Obsidian-safe form (resolveSubpath matches it to the heading)
      expect(placedLines(['## A', '- [[note2]]'], '[[note2]]', inlined)[1]).toBe('- [[#Q a b c|Q: a\\b c]]');
    });

    it('should use the nested heading link form when an existing heading matches the title only after Obsidian normalization', () => {
      // GIVEN an earlier heading "Foo: bar" — Obsidian matches it to a "Foo bar" link
      const inlined = inlinedNote({ title: 'Foo bar' });
      const lines = ['## Foo: bar', 'old', '## Third', '- see [[note2]]'];
      // WHEN placed
      // THEN the link still targets the new section
      expect(placedLines(lines, '[[note2]]', inlined)[3]).toBe('- see [[#Third#Foo bar|Foo bar]]');
    });
  });

  describe('place — refusals', () => {
    it('should refuse a regular link inside a heading line', () => {
      expect(place(['### See [[note2]]', 'Section text.'], '[[note2]]').kind).toBe('link-in-heading');
    });

    it('should refuse an embed inside a heading line', () => {
      expect(place(['## A', '### ![[note2]]', 'text'], '![[note2]]').kind).toBe('link-in-heading');
    });

    it('should refuse when the title would pass level 6', () => {
      expect(place(['###### Deep', 'See [[note2]].'], '[[note2]]').kind).toBe('too-deep');
    });

    it('should refuse when a shifted body heading would pass level 6', () => {
      // GIVEN title at ##### and a body with two heading levels (→ ###### and #######)
      const inlined = inlinedNote({ bodyLines: ['# A', '## B'] });
      expect(place(['#### Deep', 'See [[note2]].'], '[[note2]]', inlined).kind).toBe('too-deep');
    });

    it('should accept a body heading landing exactly on level 6', () => {
      const inlined = inlinedNote({ bodyLines: ['# A'] });
      expect(place(['#### Deep', 'See [[note2]].'], '[[note2]]', inlined).kind).toBe('placed');
    });

    it('should report link-moved when the link is no longer at its offsets', () => {
      // GIVEN offsets taken from an older version of the note
      const content = 'Changed text [[note2]]';
      const staleSite: InlineLinkSite = { startOffset: 0, endOffset: 9, original: '[[note2]]', isEmbed: false };
      // WHEN placed
      // THEN nothing is guessed
      expect(MarkdownSectionPlacer.place(content, NOTE1_TITLE, staleSite, inlinedNote()).kind).toBe('link-moved');
    });
  });
});
