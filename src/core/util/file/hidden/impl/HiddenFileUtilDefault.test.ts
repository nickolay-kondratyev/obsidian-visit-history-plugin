import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import { HiddenFileUtilDefault } from './HiddenFileUtilDefault';

/** Minimal in-memory DataAdapter covering exactly what HiddenFileUtilDefault calls. */
class FakeAdapter {
  readonly contents = new Map<string, string>();
  readonly folders = new Set<string>();
  readonly appendCalls: string[] = [];

  async exists(path: string): Promise<boolean> {
    return this.contents.has(path) || this.folders.has(path);
  }

  async read(path: string): Promise<string> {
    const content = this.contents.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  async write(path: string, data: string): Promise<void> {
    this.contents.set(path, data);
  }

  async append(path: string, data: string): Promise<void> {
    this.appendCalls.push(path);
    const current = this.contents.get(path);
    if (current === undefined) throw new Error(`ENOENT: ${path}`);
    this.contents.set(path, current + data);
  }

  async mkdir(path: string): Promise<void> {
    this.folders.add(path);
  }

  async list(path: string): Promise<{ files: string[]; folders: string[] }> {
    const prefix = `${path}/`;
    const folders = [...this.folders].filter(
      f => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'),
    );
    const files = [...this.contents.keys()].filter(
      f => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'),
    );
    return { files, folders };
  }

  async rmdir(path: string, _recursive: boolean): Promise<void> {
    this.folders.delete(path);
  }
}

function givenUtil() {
  const adapter = new FakeAdapter();
  // System boundary: FakeAdapter implements the DataAdapter subset the util touches.
  const util = new HiddenFileUtilDefault({ vault: { adapter } } as unknown as App);
  return { util, adapter };
}

describe('HiddenFileUtilDefault', () => {
  describe('readIfExists', () => {
    it('should return the content of an existing file', async () => {
      // GIVEN a file
      const { util, adapter } = givenUtil();
      adapter.contents.set('.vh/x.txt', 'data');
      // WHEN reading THEN the content is returned
      expect(await util.readIfExists('.vh/x.txt')).toBe('data');
    });

    it('should return null for a missing file', async () => {
      // GIVEN nothing
      const { util } = givenUtil();
      // WHEN reading THEN null (not a throw)
      expect(await util.readIfExists('.vh/missing.txt')).toBeNull();
    });
  });

  describe('write', () => {
    it('should create every missing parent folder', async () => {
      // GIVEN an empty adapter
      const { util, adapter } = givenUtil();
      // WHEN writing a deeply nested file
      await util.write('.vh/v2/dev/a.txt', 'x');
      // THEN each folder segment exists
      expect([...adapter.folders]).toEqual(['.vh', '.vh/v2', '.vh/v2/dev']);
    });

    it('should overwrite existing content', async () => {
      // GIVEN a file with old content
      const { util, adapter } = givenUtil();
      adapter.contents.set('a.txt', 'old');
      // WHEN writing
      await util.write('a.txt', 'new');
      // THEN the content is replaced
      expect(adapter.contents.get('a.txt')).toBe('new');
    });
  });

  describe('append', () => {
    it('should append to an existing file via adapter.append', async () => {
      // GIVEN an existing file
      const { util, adapter } = givenUtil();
      adapter.contents.set('a.txt', 'one\n');
      // WHEN appending
      await util.append('a.txt', 'two\n');
      // THEN content is extended
      expect(adapter.contents.get('a.txt')).toBe('one\ntwo\n');
    });

    it('should create the file (via write) when it does not exist', async () => {
      // GIVEN no file
      const { util, adapter } = givenUtil();
      // WHEN appending
      await util.append('.vh/dev/a.txt', 'one\n');
      // THEN the file was created without relying on adapter.append
      expect(adapter.appendCalls).toEqual([]);
    });

    it('should hold the appended content after create-on-append', async () => {
      // GIVEN no file
      const { util, adapter } = givenUtil();
      // WHEN appending
      await util.append('.vh/dev/a.txt', 'one\n');
      // THEN the content is present
      expect(adapter.contents.get('.vh/dev/a.txt')).toBe('one\n');
    });
  });

  describe('listSubfolderNames', () => {
    it('should return subfolder basenames', async () => {
      // GIVEN two device folders
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/focus');
      adapter.folders.add('.vh/focus/host-a');
      adapter.folders.add('.vh/focus/host-b');
      // WHEN listing
      const names = await util.listSubfolderNames('.vh/focus');
      // THEN basenames (not full paths) come back
      expect(names.sort()).toEqual(['host-a', 'host-b']);
    });

    it('should return [] when the folder does not exist', async () => {
      // GIVEN nothing
      const { util } = givenUtil();
      // WHEN listing THEN empty, no throw
      expect(await util.listSubfolderNames('.vh/missing')).toEqual([]);
    });
  });

  describe('listFileNames', () => {
    it('should return file basenames (not subfolders)', async () => {
      // GIVEN a folder with two files and a subfolder
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/dev');
      adapter.folders.add('.vh/dev/nested');
      adapter.contents.set('.vh/dev/a.vh_v3', 'x');
      adapter.contents.set('.vh/dev/b.vh_v3', 'y');
      // WHEN listing files
      const names = await util.listFileNames('.vh/dev');
      // THEN only the direct file basenames come back
      expect(names.sort()).toEqual(['a.vh_v3', 'b.vh_v3']);
    });

    it('should return [] when the folder does not exist', async () => {
      // GIVEN nothing
      const { util } = givenUtil();
      // WHEN listing THEN empty, no throw
      expect(await util.listFileNames('.vh/missing')).toEqual([]);
    });
  });

  describe('removeFolderIfEmpty', () => {
    it('should remove an empty folder and report true', async () => {
      // GIVEN an empty folder
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/empty');
      // WHEN removing
      const removed = await util.removeFolderIfEmpty('.vh/empty');
      // THEN it reports removal
      expect(removed).toBe(true);
    });

    it('should leave the empty folder gone after removal', async () => {
      // GIVEN an empty folder
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/empty');
      // WHEN removing
      await util.removeFolderIfEmpty('.vh/empty');
      // THEN the folder no longer exists
      expect(await adapter.exists('.vh/empty')).toBe(false);
    });

    it('should not remove a folder containing files (returns false)', async () => {
      // GIVEN a folder with a file
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/full');
      adapter.contents.set('.vh/full/a.txt', 'x');
      // WHEN removing THEN it reports no removal
      expect(await util.removeFolderIfEmpty('.vh/full')).toBe(false);
    });

    it('should keep the file-holding folder intact', async () => {
      // GIVEN a folder with a file
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/full');
      adapter.contents.set('.vh/full/a.txt', 'x');
      // WHEN removing
      await util.removeFolderIfEmpty('.vh/full');
      // THEN the folder is still present
      expect(await adapter.exists('.vh/full')).toBe(true);
    });

    it('should not remove a folder containing subfolders (returns false)', async () => {
      // GIVEN a folder with a subfolder
      const { util, adapter } = givenUtil();
      adapter.folders.add('.vh/parent');
      adapter.folders.add('.vh/parent/child');
      // WHEN removing THEN it reports no removal
      expect(await util.removeFolderIfEmpty('.vh/parent')).toBe(false);
    });

    it('should report false for an absent folder', async () => {
      // GIVEN nothing
      const { util } = givenUtil();
      // WHEN removing THEN false, no throw
      expect(await util.removeFolderIfEmpty('.vh/missing')).toBe(false);
    });
  });
});
