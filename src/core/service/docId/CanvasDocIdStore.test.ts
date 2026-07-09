import { describe, expect, it, vi } from 'vitest';
import { CanvasDocIdStore } from './CanvasDocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';

class FixedDocIdGenerator implements DocIdGenerator {
  constructor(private readonly id: string) {
  }

  generate(): string {
    return this.id;
  }
}

const GENERATED_ID = 'docid_BBBBBBBBBBBBBBBBBBBBB_E';

interface Setup {
  store: CanvasDocIdStore;
  noteFileUtil: FakeNoteFileUtil;
}

function setup(): Setup {
  const noteFileUtil = new FakeNoteFileUtil();
  const store = new CanvasDocIdStore(noteFileUtil, new FixedDocIdGenerator(GENERATED_ID));
  return { store, noteFileUtil };
}

function parseContent(noteFileUtil: FakeNoteFileUtil, path: string): unknown {
  return JSON.parse(noteFileUtil.getContent(path) ?? 'null');
}

describe('CanvasDocIdStore', () => {
  describe('ensureId', () => {
    it('should return the existing metadata.frontmatter.id without modifying the file', async () => {
      // GIVEN a canvas that already carries an id
      const { store, noteFileUtil } = setup();
      const original = JSON.stringify({ nodes: [], metadata: { frontmatter: { id: 'canvas-id-1' } } });
      const file = noteFileUtil.seedNote('boards/a.canvas', original);
      // WHEN
      const id = await store.ensureId(file);
      // THEN id returned and content byte-identical (no reformat)
      expect({ id, content: noteFileUtil.getContent('boards/a.canvas') })
        .toEqual({ id: 'canvas-id-1', content: original });
    });

    it('should write a generated id into existing metadata.frontmatter', async () => {
      // GIVEN a canvas with metadata.frontmatter but no id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote(
        'boards/a.canvas',
        JSON.stringify({ nodes: [], edges: [], metadata: { frontmatter: {} } }),
      );
      // WHEN
      const id = await store.ensureId(file);
      // THEN
      expect({ id, canvas: parseContent(noteFileUtil, 'boards/a.canvas') }).toEqual({
        id: GENERATED_ID,
        canvas: { nodes: [], edges: [], metadata: { frontmatter: { id: GENERATED_ID } } },
      });
    });

    it('should create metadata.frontmatter when absent', async () => {
      // GIVEN a canvas without any metadata object
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('boards/a.canvas', JSON.stringify({ nodes: [], edges: [] }));
      // WHEN
      await store.ensureId(file);
      // THEN
      expect(parseContent(noteFileUtil, 'boards/a.canvas')).toEqual({
        nodes: [],
        edges: [],
        metadata: { frontmatter: { id: GENERATED_ID } },
      });
    });

    it('should preserve other canvas data when adding the id', async () => {
      // GIVEN a canvas with nodes and unrelated metadata
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote(
        'boards/a.canvas',
        JSON.stringify({ nodes: [{ id: 'n1', type: 'text' }], metadata: { frontmatter: { tags: ['t'] } } }),
      );
      // WHEN
      await store.ensureId(file);
      // THEN
      expect(parseContent(noteFileUtil, 'boards/a.canvas')).toEqual({
        nodes: [{ id: 'n1', type: 'text' }],
        metadata: { frontmatter: { tags: ['t'], id: GENERATED_ID } },
      });
    });

    it('should return a non-string existing id as string', async () => {
      // GIVEN a numeric id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote(
        'boards/a.canvas',
        JSON.stringify({ metadata: { frontmatter: { id: 42 } } }),
      );
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('42');
    });

    it('should NOT overwrite an object-valued id (unusable but occupied slot)', async () => {
      // GIVEN a canvas whose id slot holds an object
      const { store, noteFileUtil } = setup();
      const original = JSON.stringify({ metadata: { frontmatter: { id: { weird: true } } } });
      const file = noteFileUtil.seedNote('boards/a.canvas', original);
      // WHEN
      const id = await store.ensureId(file);
      // THEN no usable id, and the file is untouched
      expect({ id, content: noteFileUtil.getContent('boards/a.canvas') })
        .toEqual({ id: null, content: original });
    });

    it('should return null for malformed JSON without throwing or writing', async () => {
      // GIVEN a corrupt canvas file
      const { store, noteFileUtil } = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = noteFileUtil.seedNote('boards/bad.canvas', '{not json');
      // WHEN
      const id = await store.ensureId(file);
      // THEN
      expect({ id, content: noteFileUtil.getContent('boards/bad.canvas') })
        .toEqual({ id: null, content: '{not json' });
      consoleError.mockRestore();
    });

    it('should return null when the canvas root is not an object', async () => {
      // GIVEN a JSON array as canvas root
      const { store, noteFileUtil } = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = noteFileUtil.seedNote('boards/array.canvas', '[]');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBeNull();
      consoleError.mockRestore();
    });
  });
});
