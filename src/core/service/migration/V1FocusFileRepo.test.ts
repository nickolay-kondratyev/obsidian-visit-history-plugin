import { describe, expect, it } from 'vitest';
import { App, TAbstractFile, TFolder } from 'obsidian';
import { V1FocusFileRepoDefault } from './V1FocusFileRepo';
import { makeTFile } from '../../../testSupport/fileFactory';

function makeFolder(path: string, children: TAbstractFile[]): TFolder {
  const folder = new TFolder();
  folder.path = path;
  folder.name = path.slice(path.lastIndexOf('/') + 1);
  folder.children = children;
  return folder;
}

/** Minimal in-memory Vault covering exactly what V1FocusFileRepoDefault calls. */
class FakeVault {
  private readonly folderByPath = new Map<string, TFolder>();
  readonly deletedPaths: string[] = [];

  addFolder(folder: TFolder): void {
    this.folderByPath.set(folder.path, folder);
  }

  getFolderByPath(path: string): TFolder | null {
    return this.folderByPath.get(path) ?? null;
  }

  async delete(file: TAbstractFile, _force?: boolean): Promise<void> {
    this.deletedPaths.push(file.path);
    this.folderByPath.delete(file.path);
  }
}

function givenRepo() {
  const vault = new FakeVault();
  // System boundary: FakeVault implements the Vault subset the repo touches.
  const repo = new V1FocusFileRepoDefault({ vault } as unknown as App);
  return { repo, vault };
}

describe('V1FocusFileRepoDefault', () => {
  describe('v1TreeExists', () => {
    it('should be true when _visit_history exists', () => {
      const { repo, vault } = givenRepo();
      vault.addFolder(makeFolder('_visit_history', []));
      expect(repo.v1TreeExists()).toBe(true);
    });

    it('should be false when _visit_history is absent', () => {
      expect(givenRepo().repo.v1TreeExists()).toBe(false);
    });
  });

  describe('findAllV1FocusFiles', () => {
    it('should return every file with its device directory name', () => {
      // GIVEN two device dirs with VH files
      const { repo, vault } = givenRepo();
      const fileA = makeTFile({ path: '_visit_history/v1/focus/mac/_vh_01A.md' });
      const fileB = makeTFile({ path: '_visit_history/v1/focus/phone/_vh_01B.md' });
      vault.addFolder(makeFolder('_visit_history/v1/focus', [
        makeFolder('_visit_history/v1/focus/mac', [fileA]),
        makeFolder('_visit_history/v1/focus/phone', [fileB]),
      ]));
      // WHEN / THEN
      expect(repo.findAllV1FocusFiles()).toEqual([
        { file: fileA, deviceName: 'mac' },
        { file: fileB, deviceName: 'phone' },
      ]);
    });

    it('should skip stray files directly under focus/ (not in a device dir)', () => {
      // GIVEN a file sitting outside any device dir
      const { repo, vault } = givenRepo();
      vault.addFolder(makeFolder('_visit_history/v1/focus', [
        makeTFile({ path: '_visit_history/v1/focus/stray.md' }),
      ]));
      // WHEN / THEN
      expect(repo.findAllV1FocusFiles()).toEqual([]);
    });

    it('should return [] when the focus dir is absent', () => {
      expect(givenRepo().repo.findAllV1FocusFiles()).toEqual([]);
    });
  });

  describe('deleteV1TreePermanently', () => {
    it('should delete the whole _visit_history tree', async () => {
      // GIVEN the V1 tree
      const { repo, vault } = givenRepo();
      vault.addFolder(makeFolder('_visit_history', []));
      // WHEN
      await repo.deleteV1TreePermanently();
      // THEN
      expect(vault.deletedPaths).toEqual(['_visit_history']);
    });

    it('should no-op when the tree is already gone', async () => {
      // GIVEN no tree
      const { repo, vault } = givenRepo();
      // WHEN
      await repo.deleteV1TreePermanently();
      // THEN nothing deleted, no throw
      expect(vault.deletedPaths).toEqual([]);
    });
  });
});
