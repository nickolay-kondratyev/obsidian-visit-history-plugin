import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { DocIdBackfillServiceDefault } from './DocIdBackfillService';
import { DocIdServiceDefault } from './DocIdService';
import { FrontmatterDocIdStore } from './FrontmatterDocIdStore';
import { CanvasDocIdStore } from './CanvasDocIdStore';
import { DocIdGeneratorDefault } from './DocIdGenerator';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FakeVaultUtil } from '../../../testSupport/fakes';

const DOC_ID_REGEX = /^docid_[0-9a-zA-Z]{21}_E$/;
// Frontmatter block whose only entry is a generated doc id.
const FRONTMATTER_WITH_DOC_ID_REGEX = /^---\nid: (docid_[0-9a-zA-Z]{21}_E)\n/;

/**
 * Integration: real DocIdBackfillServiceDefault → DocIdServiceDefault →
 * Frontmatter/CanvasDocIdStore → DocIdGeneratorDefault. Faked only at the
 * Obsidian boundary (NoteFileUtil, VaultUtil) — proves the backfill actually
 * mutates file content the same way focus does.
 */
interface Setup {
  service: DocIdBackfillServiceDefault;
  noteFileUtil: FakeNoteFileUtil;
}

/** Seeds the given path→content vault and wires the real production graph. */
function setup(vaultContent: Record<string, string>): Setup {
  const noteFileUtil = new FakeNoteFileUtil();
  const files: TFile[] = Object.entries(vaultContent)
    .map(([path, content]) => noteFileUtil.seedNote(path, content));

  const docIdGenerator = new DocIdGeneratorDefault();
  const docIdService = new DocIdServiceDefault(
    new FrontmatterDocIdStore(noteFileUtil, docIdGenerator),
    new CanvasDocIdStore(noteFileUtil, docIdGenerator),
  );
  const service = new DocIdBackfillServiceDefault(new FakeVaultUtil(files), docIdService);
  return { service, noteFileUtil };
}

describe('DocIdBackfillServiceDefault (integration)', () => {
  describe('backfillAll', () => {
    it('should write a docid-format id into the frontmatter of a plain md note', async () => {
      // GIVEN
      const { service, noteFileUtil } = setup({ 'notes/plain.md': '# Heading only' });
      // WHEN
      await service.backfillAll();
      // THEN
      expect(noteFileUtil.getContent('notes/plain.md')).toMatch(FRONTMATTER_WITH_DOC_ID_REGEX);
    });

    it('should write a docid-format id into the frontmatter of an .excalidraw.md file', async () => {
      // GIVEN
      const { service, noteFileUtil } = setup({ 'draw/sketch.excalidraw.md': 'excalidraw body' });
      // WHEN
      await service.backfillAll();
      // THEN
      expect(noteFileUtil.getContent('draw/sketch.excalidraw.md'))
        .toMatch(FRONTMATTER_WITH_DOC_ID_REGEX);
    });

    it('should leave an md note with an existing id completely untouched', async () => {
      // GIVEN
      const { service, noteFileUtil } = setup({
        'notes/has-id.md': '---\nid: existing-id-123\n---\nbody',
      });
      // WHEN
      await service.backfillAll();
      // THEN no write happened at all (raw-content fast path)
      expect({
        writes: noteFileUtil.processCallCount,
        content: noteFileUtil.getContent('notes/has-id.md'),
      }).toEqual({ writes: 0, content: '---\nid: existing-id-123\n---\nbody' });
    });

    it('should preserve unrelated frontmatter fields byte-for-byte when adding an id', async () => {
      // GIVEN quoted keys that Obsidian's own serializer would normalize
      const { service, noteFileUtil } = setup({
        'notes/quoted.md': '---\n"someother field 3": v3\n---\nbody',
      });
      // WHEN
      await service.backfillAll();
      // THEN quotes survive; only the id line is new
      expect(noteFileUtil.getContent('notes/quoted.md'))
        .toMatch(/^---\nid: docid_[0-9a-zA-Z]{21}_E\n"someother field 3": v3\n---\nbody$/);
    });

    it('should write metadata.frontmatter.id into a canvas without an id', async () => {
      // GIVEN
      const { service, noteFileUtil } = setup({ 'boards/empty.canvas': '{"nodes":[]}' });
      // WHEN
      await service.backfillAll();
      // THEN
      const canvas = JSON.parse(noteFileUtil.getContent('boards/empty.canvas') ?? '') as {
        metadata?: { frontmatter?: { id?: string } };
      };
      expect(canvas.metadata?.frontmatter?.id).toMatch(DOC_ID_REGEX);
    });

    it('should leave a canvas with an existing id byte-identical', async () => {
      // GIVEN
      const content = '{"nodes":[],"metadata":{"frontmatter":{"id":"canvas-id-1"}}}';
      const { service, noteFileUtil } = setup({ 'boards/has-id.canvas': content });
      // WHEN
      await service.backfillAll();
      // THEN
      expect(noteFileUtil.getContent('boards/has-id.canvas')).toBe(content);
    });

    it('should not modify a raw .excalidraw file (ineligible)', async () => {
      // GIVEN
      const { service, noteFileUtil } = setup({ 'draw/raw.excalidraw': '{"type":"excalidraw"}' });
      // WHEN
      await service.backfillAll();
      // THEN
      expect(noteFileUtil.getContent('draw/raw.excalidraw')).toBe('{"type":"excalidraw"}');
    });

    it('should report a malformed canvas as failed while leaving it unmodified', async () => {
      // GIVEN
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { service, noteFileUtil } = setup({ 'boards/broken.canvas': 'not json at all' });
      // WHEN
      const result = await service.backfillAll();
      consoleError.mockRestore();
      // THEN
      expect({ failedPaths: result.failedPaths, content: noteFileUtil.getContent('boards/broken.canvas') })
        .toEqual({ failedPaths: ['boards/broken.canvas'], content: 'not json at all' });
    });

    it('should process a mixed vault end-to-end with the correct summary', async () => {
      // GIVEN one of each kind (broken canvas logs via console.error)
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { service } = setup({
        'notes/plain.md': 'body',
        'notes/has-id.md': '---\nid: existing-id-123\n---\nbody',
        'draw/sketch.excalidraw.md': 'excalidraw body',
        'boards/empty.canvas': '{"nodes":[]}',
        'boards/broken.canvas': 'not json at all',
        'draw/raw.excalidraw': '{"type":"excalidraw"}',
      });
      // WHEN
      const result = await service.backfillAll();
      consoleError.mockRestore();
      // THEN all but raw.excalidraw are eligible; only the broken canvas fails
      expect(result).toEqual({ eligibleFileCount: 5, failedPaths: ['boards/broken.canvas'] });
    });
  });
});
