import type { DataAdapter } from 'obsidian';

/** The DataAdapter calls the git reader needs — all read-only. */
export type GitDirReader = Pick<DataAdapter, 'stat' | 'list' | 'read' | 'readBinary'>;

/**
 * Node-style error, as isomorphic-git expects: it treats `code` ENOENT as
 * "missing" (e.g. probing for a loose object before the packfiles).
 */
class FsError extends Error {
  constructor(readonly code: 'ENOENT' | 'EROFS', path: string) {
    super(`${code}: path=[${path}]`);
  }
}

/** The subset of Node's `fs.Stats` isomorphic-git reads. */
class AdapterStats {
  /** Regular file 0o100644 / directory 0o040000 — git's own mode values. */
  private static readonly FILE_MODE = 0o100644;
  private static readonly FOLDER_MODE = 0o040000;

  readonly mode: number;
  readonly ino = 0;
  readonly uid = 0;
  readonly gid = 0;
  readonly dev = 0;

  constructor(
    private readonly kind: 'file' | 'folder',
    readonly size: number,
    readonly mtimeMs: number,
    readonly ctimeMs: number,
  ) {
    this.mode = kind === 'file' ? AdapterStats.FILE_MODE : AdapterStats.FOLDER_MODE;
  }

  isFile(): boolean {
    return this.kind === 'file';
  }

  isDirectory(): boolean {
    return this.kind === 'folder';
  }

  isSymbolicLink(): boolean {
    return false;
  }
}

/**
 * A promise-style `fs` for isomorphic-git over Obsidian's DataAdapter — the
 * only file API that reaches `.git` on desktop AND mobile (the Vault API
 * never yields dot-folders; Node's `fs` doesn't exist on mobile).
 *
 * READ-ONLY by construction: every write method rejects, so no code path
 * can ever modify the repository. Paths arrive from isomorphic-git relative
 * to the vault root (we pass `gitdir: '.git'`).
 */
export class ReadOnlyDataAdapterFs {
  /** isomorphic-git detects a promise fs by this enumerable `promises` property. */
  readonly promises = {
    readFile: (path: string, options?: unknown): Promise<string | Uint8Array> => this.readFile(path, options),
    readdir: (path: string): Promise<string[]> => this.readdir(path),
    stat: (path: string): Promise<AdapterStats> => this.stat(path),
    // No symlinks through the DataAdapter — lstat is stat.
    lstat: (path: string): Promise<AdapterStats> => this.stat(path),
    readlink: (path: string): Promise<never> => Promise.reject(new FsError('ENOENT', path)),
    writeFile: (path: string): Promise<never> => ReadOnlyDataAdapterFs.rejectWrite(path),
    unlink: (path: string): Promise<never> => ReadOnlyDataAdapterFs.rejectWrite(path),
    mkdir: (path: string): Promise<never> => ReadOnlyDataAdapterFs.rejectWrite(path),
    rmdir: (path: string): Promise<never> => ReadOnlyDataAdapterFs.rejectWrite(path),
    symlink: (path: string): Promise<never> => ReadOnlyDataAdapterFs.rejectWrite(path),
    chmod: (path: string): Promise<never> => ReadOnlyDataAdapterFs.rejectWrite(path),
  };

  constructor(private readonly adapter: GitDirReader) {
  }

  /** A text file's content, or `undefined` when there is no file at the path. */
  async readTextIfExists(rawPath: string): Promise<string | undefined> {
    const path = ReadOnlyDataAdapterFs.vaultPath(rawPath);
    const stat = await this.adapter.stat(path);
    return stat?.type === 'file' ? this.adapter.read(path) : undefined;
  }

  private async readFile(rawPath: string, options: unknown): Promise<string | Uint8Array> {
    const path = ReadOnlyDataAdapterFs.vaultPath(rawPath);
    const stat = await this.adapter.stat(path);
    if (stat?.type !== 'file') throw new FsError('ENOENT', path);
    if (ReadOnlyDataAdapterFs.wantsText(options)) return this.adapter.read(path);
    return new Uint8Array(await this.adapter.readBinary(path));
  }

  private async readdir(rawPath: string): Promise<string[]> {
    const path = ReadOnlyDataAdapterFs.vaultPath(rawPath);
    const stat = await this.adapter.stat(path);
    if (stat?.type !== 'folder') throw new FsError('ENOENT', path);
    const listed = await this.adapter.list(path);
    // adapter.list returns full vault-relative paths — fs wants basenames.
    return [...listed.files, ...listed.folders].map(full => full.slice(full.lastIndexOf('/') + 1));
  }

  private async stat(rawPath: string): Promise<AdapterStats> {
    const path = ReadOnlyDataAdapterFs.vaultPath(rawPath);
    const stat = await this.adapter.stat(path);
    if (stat === null) throw new FsError('ENOENT', path);
    return new AdapterStats(stat.type, stat.size, stat.mtime, stat.ctime);
  }

  /** Node's `readFile(path, 'utf8')` / `{ encoding: 'utf8' }` → text; anything else → bytes. */
  private static wantsText(options: unknown): boolean {
    if (typeof options === 'string') return true;
    return typeof options === 'object' && options !== null && 'encoding' in options && typeof options.encoding === 'string';
  }

  /** isomorphic-git may hand `./.git/…` or `/.git/…`; the adapter wants `.git/…`. */
  private static vaultPath(rawPath: string): string {
    return rawPath.replace(/^(\.\/|\/)+/, '');
  }

  private static rejectWrite(path: string): Promise<never> {
    return Promise.reject(new FsError('EROFS', path));
  }
}
