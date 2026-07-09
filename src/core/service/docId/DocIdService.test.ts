import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { DocIdServiceDefault } from './DocIdService';
import { DocIdStore } from './DocIdStore';
import { makeTFile } from '../../../testSupport/fileFactory';

class RecordingDocIdStore implements DocIdStore {
  readonly ensuredPaths: string[] = [];
  readonly gotPaths: string[] = [];

  constructor(private readonly id: string) {
  }

  async ensureId(file: TFile): Promise<string | null> {
    this.ensuredPaths.push(file.path);
    return this.id;
  }

  async getId(file: TFile): Promise<string | null> {
    this.gotPaths.push(file.path);
    return this.id;
  }
}

interface Setup {
  service: DocIdServiceDefault;
  frontmatterStore: RecordingDocIdStore;
  canvasStore: RecordingDocIdStore;
}

function setup(): Setup {
  const frontmatterStore = new RecordingDocIdStore('frontmatter-id');
  const canvasStore = new RecordingDocIdStore('canvas-id');
  return { service: new DocIdServiceDefault(frontmatterStore, canvasStore), frontmatterStore, canvasStore };
}

describe('DocIdServiceDefault', () => {
  describe('ensureDocId', () => {
    it('should dispatch .md files to the frontmatter store', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'notes/a.md' }))).toBe('frontmatter-id');
    });

    it('should dispatch .excalidraw.md files to the frontmatter store (extension is md)', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'draw/a.excalidraw.md' }))).toBe('frontmatter-id');
    });

    it('should dispatch .canvas files to the canvas store', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'boards/a.canvas' }))).toBe('canvas-id');
    });

    it('should return null for raw .excalidraw files without touching any store', async () => {
      // GIVEN
      const { service, frontmatterStore, canvasStore } = setup();
      // WHEN
      const id = await service.ensureDocId(makeTFile({ path: 'draw/raw.excalidraw' }));
      // THEN raw .excalidraw is intentionally unsupported (owner decision)
      expect({ id, calls: [...frontmatterStore.ensuredPaths, ...canvasStore.ensuredPaths] })
        .toEqual({ id: null, calls: [] });
    });

    it('should return null for untracked extensions', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'img/pic.png' }))).toBeNull();
    });
  });

  describe('getDocId', () => {
    it('should dispatch .md files to the frontmatter store read path', async () => {
      // GIVEN
      const { service, frontmatterStore } = setup();
      // WHEN
      const id = await service.getDocId(makeTFile({ path: 'notes/a.md' }));
      // THEN the read-only store path was used
      expect({ id, gotPaths: frontmatterStore.gotPaths })
        .toEqual({ id: 'frontmatter-id', gotPaths: ['notes/a.md'] });
    });

    it('should dispatch .canvas files to the canvas store read path', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.getDocId(makeTFile({ path: 'boards/a.canvas' }))).toBe('canvas-id');
    });

    it('should never call ensureId (read-only contract)', async () => {
      // GIVEN
      const { service, frontmatterStore, canvasStore } = setup();
      // WHEN
      await service.getDocId(makeTFile({ path: 'notes/a.md' }));
      await service.getDocId(makeTFile({ path: 'boards/a.canvas' }));
      // THEN no write path was touched
      expect([...frontmatterStore.ensuredPaths, ...canvasStore.ensuredPaths]).toEqual([]);
    });

    it('should return null for unsupported extensions', async () => {
      // GIVEN / WHEN / THEN
      expect(await setup().service.getDocId(makeTFile({ path: 'draw/raw.excalidraw' }))).toBeNull();
    });
  });

  describe('isEligible', () => {
    it('should be true for .md files', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'notes/a.md' }))).toBe(true);
    });

    it('should be true for .excalidraw.md files (extension is md)', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'draw/a.excalidraw.md' }))).toBe(true);
    });

    it('should be true for .canvas files', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'boards/a.canvas' }))).toBe(true);
    });

    it('should be false for raw .excalidraw files', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'draw/raw.excalidraw' }))).toBe(false);
    });

    it('should be false for untracked extensions', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'img/pic.png' }))).toBe(false);
    });
  });
});
