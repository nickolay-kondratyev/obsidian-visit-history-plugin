import { describe, expect, it } from 'vitest';
import { CanvasReferenceScanner, LinkpathResolver } from './CanvasReferenceScanner';
import { makeTFile } from '../../../testSupport/fileFactory';

const CANVAS = makeTFile({ path: 'boards/board.canvas' });
const TARGET = 'notes/note2.md';

/** Resolves bare names and `.md` names in `notes/` — enough for these cases. */
const resolve: LinkpathResolver = (linkpath) => {
  const withExtension = linkpath.endsWith('.md') ? linkpath : `${linkpath}.md`;
  const name = withExtension.split('/').at(-1);
  return name === 'note2.md' ? TARGET : name === 'other.md' ? 'notes/other.md' : null;
};

function canvasJson(nodes: unknown[]): string {
  return JSON.stringify({ nodes, edges: [] });
}

describe('CanvasReferenceScanner', () => {
  describe('scan', () => {
    it('should count a file card pointing at the note', () => {
      // GIVEN a canvas with one file card for note2
      const json = canvasJson([{ id: '1', type: 'file', file: TARGET }]);
      // WHEN scanned
      // THEN one reference is found
      expect(CanvasReferenceScanner.scan(CANVAS, json, TARGET, resolve)).toHaveLength(1);
    });

    it('should keep the subpath of a file card showing part of the note', () => {
      const json = canvasJson([{ id: '1', type: 'file', file: TARGET, subpath: '#Heading' }]);
      expect(CanvasReferenceScanner.scan(CANVAS, json, TARGET, resolve)[0]?.subpath).toBe('#Heading');
    });

    it('should count each link to the note inside a text card', () => {
      // GIVEN a text card linking note2 twice (wikilink + markdown link)
      const json = canvasJson([{ id: '1', type: 'text', text: 'See [[note2]] and [again](note2.md)' }]);
      // WHEN scanned
      // THEN both links count
      expect(CanvasReferenceScanner.scan(CANVAS, json, TARGET, resolve)).toHaveLength(2);
    });

    it('should resolve text card links relative to the canvas', () => {
      // GIVEN a resolver that records the source path it was asked for
      const sourcePaths: string[] = [];
      const recordingResolve: LinkpathResolver = (linkpath, sourcePath) => {
        sourcePaths.push(sourcePath);
        return resolve(linkpath, sourcePath);
      };
      const json = canvasJson([{ id: '1', type: 'text', text: '[[note2]]' }]);
      // WHEN scanned
      CanvasReferenceScanner.scan(CANVAS, json, TARGET, recordingResolve);
      // THEN the canvas path is the link source
      expect(sourcePaths).toEqual([CANVAS.path]);
    });

    it('should ignore cards about other notes', () => {
      const json = canvasJson([
        { id: '1', type: 'file', file: 'notes/other.md' },
        { id: '2', type: 'text', text: '[[other]]' },
      ]);
      expect(CanvasReferenceScanner.scan(CANVAS, json, TARGET, resolve)).toEqual([]);
    });

    it('should ignore link and group cards', () => {
      const json = canvasJson([
        { id: '1', type: 'link', url: 'https://example.com/note2.md' },
        { id: '2', type: 'group', label: '[[note2]]' },
      ]);
      expect(CanvasReferenceScanner.scan(CANVAS, json, TARGET, resolve)).toEqual([]);
    });

    it('should find nothing in an empty (brand-new) canvas', () => {
      expect(CanvasReferenceScanner.scan(CANVAS, '', TARGET, resolve)).toEqual([]);
    });

    it('should find nothing in unparseable JSON without throwing', () => {
      expect(CanvasReferenceScanner.scan(CANVAS, '{ not json', TARGET, resolve)).toEqual([]);
    });

    it('should find nothing when nodes is not an array', () => {
      expect(CanvasReferenceScanner.scan(CANVAS, '{"nodes": {}}', TARGET, resolve)).toEqual([]);
    });
  });
});
