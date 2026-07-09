import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { DocIdServiceDefault } from './DocIdService';
import { DocIdStore } from './DocIdStore';
import { makeTFile } from '../../../testSupport/fileFactory';

class RecordingDocIdStore implements DocIdStore {
  readonly ensuredPaths: string[] = [];

  constructor(private readonly id: string) {
  }

  async ensureId(file: TFile): Promise<string | null> {
    this.ensuredPaths.push(file.path);
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
