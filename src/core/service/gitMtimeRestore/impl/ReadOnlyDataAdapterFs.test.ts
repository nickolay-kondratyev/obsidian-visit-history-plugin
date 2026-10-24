import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFsGitDirReader } from '../../../../testSupport/NodeFsGitDirReader';
import { ReadOnlyDataAdapterFs } from './ReadOnlyDataAdapterFs';

describe('ReadOnlyDataAdapterFs', () => {
  let root: string;
  let fs: ReadOnlyDataAdapterFs;

  beforeEach(() => {
    // GIVEN .git/HEAD and .git/objects/ab/cd on disk
    root = mkdtempSync(join(tmpdir(), 'vh-rofs-'));
    mkdirSync(join(root, '.git/objects/ab'), { recursive: true });
    writeFileSync(join(root, '.git/HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(root, '.git/objects/ab/cd'), Uint8Array.from([0, 1, 2, 255]));
    fs = new ReadOnlyDataAdapterFs(new NodeFsGitDirReader(root));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('promises.readFile', () => {
    it('should return text when an encoding is given', async () => {
      expect(await fs.promises.readFile('.git/HEAD', { encoding: 'utf8' })).toBe('ref: refs/heads/main\n');
    });

    it('should return the exact bytes when no encoding is given', async () => {
      const bytes = await fs.promises.readFile('.git/objects/ab/cd');
      expect(bytes instanceof Uint8Array ? [...bytes] : bytes).toEqual([0, 1, 2, 255]);
    });

    it('should accept the ./-prefixed paths isomorphic-git may build', async () => {
      expect(await fs.promises.readFile('./.git/HEAD', 'utf8')).toBe('ref: refs/heads/main\n');
    });

    it('should reject with ENOENT for a missing file', async () => {
      await expect(fs.promises.readFile('.git/nope')).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('should reject with ENOENT for a folder', async () => {
      await expect(fs.promises.readFile('.git/objects')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('promises.readdir', () => {
    it('should list basenames of files and folders', async () => {
      expect((await fs.promises.readdir('.git')).sort()).toEqual(['HEAD', 'objects']);
    });

    it('should reject with ENOENT for a missing folder', async () => {
      await expect(fs.promises.readdir('.git/refs')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('promises.stat', () => {
    it('should report a folder as a directory', async () => {
      expect((await fs.promises.stat('.git/objects')).isDirectory()).toBe(true);
    });

    it('should reject with ENOENT for a missing path', async () => {
      await expect(fs.promises.stat('.git/missing')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('write methods', () => {
    it.each(['writeFile', 'unlink', 'mkdir', 'rmdir', 'symlink', 'chmod'] as const)(
      'should reject %s with EROFS',
      async method => {
        await expect(fs.promises[method]('.git/x')).rejects.toMatchObject({ code: 'EROFS' });
      },
    );

    it('should leave the repo folder untouched after rejected writes', async () => {
      await Promise.allSettled([fs.promises.writeFile('.git/x'), fs.promises.mkdir('.git/y')]);
      expect(readdirSync(join(root, '.git')).sort()).toEqual(['HEAD', 'objects']);
    });
  });

  describe('readTextIfExists', () => {
    it('should be undefined when the file is absent', async () => {
      expect(await fs.readTextIfExists('.git/shallow')).toBeUndefined();
    });

    it('should return the text when present', async () => {
      expect(await fs.readTextIfExists('.git/HEAD')).toBe('ref: refs/heads/main\n');
    });
  });
});
