import { describe, expect, it } from 'vitest';
import { App, TFile, TFolder } from 'obsidian';
import { NoteFileUtilDefault } from './NoteFileUtilDefault';
import { makeTFile } from '../../../../../testSupport/fileFactory';

/** Minimal in-memory Vault covering exactly what NoteFileUtilDefault calls. */
class FakeVault {
  private readonly files = new Map<string, TFile>();
  private readonly folders = new Set<string>();
  readonly contents = new Map<string, string>();
  readonly createdFolders: string[] = [];

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    const file = this.files.get(path);
    if (file) return file;
    return this.folders.has(path) ? new TFolder() : null;
  }

  async create(path: string, content: string): Promise<TFile> {
    const file = makeTFile({ path });
    this.files.set(path, file);
    this.contents.set(path, content);
    return file;
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
    this.createdFolders.push(path);
  }

  async process(file: TFile, fn: (data: string) => string): Promise<string> {
    const updated = fn(this.contents.get(file.path)!);
    this.contents.set(file.path, updated);
    return updated;
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.contents.get(file.path)!;
  }

  seedFolder(path: string): void {
    this.folders.add(path);
  }
}

function givenUtil() {
  const vault = new FakeVault();
  // System boundary: FakeVault implements the Vault subset the util touches.
  const util = new NoteFileUtilDefault({ vault } as unknown as App);
  return { util, vault };
}

describe('NoteFileUtilDefault', () => {
  describe('createNote', () => {
    it('should create the note with initial content', async () => {
      // GIVEN an empty vault
      const { util, vault } = givenUtil();
      // WHEN creating a note
      await util.createNote('a/b/note.md', 'hello');
      // THEN the content is stored
      expect(vault.contents.get('a/b/note.md')).toBe('hello');
    });

    it('should create missing parent folders', async () => {
      // GIVEN an empty vault
      const { util, vault } = givenUtil();
      // WHEN creating a nested note
      await util.createNote('a/b/note.md');
      // THEN the parent folder was created
      expect(vault.createdFolders).toContain('a/b');
    });

    it('should not re-create an existing parent folder', async () => {
      // GIVEN the parent folder already exists
      const { util, vault } = givenUtil();
      vault.seedFolder('a/b');
      // WHEN creating a nested note
      await util.createNote('a/b/note.md');
      // THEN no folder creation happened
      expect(vault.createdFolders).toEqual([]);
    });

    it('should throw when a file already exists at the path', async () => {
      // GIVEN a note already exists
      const { util } = givenUtil();
      await util.createNote('note.md');
      // WHEN creating it again THEN it throws
      await expect(util.createNote('note.md')).rejects.toThrow('already exists');
    });
  });

  describe('appendLineToNote', () => {
    it('should append with a trailing newline', async () => {
      // GIVEN a note ending with a newline
      const { util, vault } = givenUtil();
      await util.createNote('note.md', 'header\n');
      // WHEN appending a line
      await util.appendLineToNote('note.md', 'stamp');
      // THEN the line lands on its own row, newline-terminated
      expect(vault.contents.get('note.md')).toBe('header\nstamp\n');
    });

    it('should insert a separator when the file does not end with a newline', async () => {
      // GIVEN a note without a trailing newline
      const { util, vault } = givenUtil();
      await util.createNote('note.md', 'header');
      // WHEN appending a line
      await util.appendLineToNote('note.md', 'stamp');
      // THEN the appended line does not glue onto the last line
      expect(vault.contents.get('note.md')).toBe('header\nstamp\n');
    });

    it('should throw when the file does not exist', async () => {
      // GIVEN an empty vault
      const { util } = givenUtil();
      // WHEN appending THEN it throws
      await expect(util.appendLineToNote('missing.md', 'stamp')).rejects.toThrow('File not found');
    });

    it('should throw when the path is a folder', async () => {
      // GIVEN a folder at the path
      const { util, vault } = givenUtil();
      vault.seedFolder('some-folder');
      // WHEN appending THEN it throws with a descriptive error
      await expect(util.appendLineToNote('some-folder', 'stamp')).rejects.toThrow('folder');
    });
  });
});
