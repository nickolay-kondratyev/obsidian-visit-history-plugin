import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ListedFiles, Stat } from 'obsidian';
import { GitDirReader } from '../core/service/gitMtimeRestore/impl/ReadOnlyDataAdapterFs';

/**
 * GitDirReader over a real folder on disk — stands in for Obsidian's
 * DataAdapter (vault-relative paths, `stat` → null when missing) so
 * integration tests run the real isomorphic-git against a real repo.
 */
export class NodeFsGitDirReader implements GitDirReader {
  constructor(private readonly rootDir: string) {
  }

  async stat(path: string): Promise<Stat | null> {
    try {
      const s = await stat(this.abs(path));
      return { type: s.isDirectory() ? 'folder' : 'file', ctime: s.ctimeMs, mtime: s.mtimeMs, size: s.size };
    } catch {
      return null;
    }
  }

  async list(path: string): Promise<ListedFiles> {
    const entries = await readdir(this.abs(path), { withFileTypes: true });
    const full = (name: string): string => (path === '' ? name : `${path}/${name}`);
    return {
      files: entries.filter(e => !e.isDirectory()).map(e => full(e.name)),
      folders: entries.filter(e => e.isDirectory()).map(e => full(e.name)),
    };
  }

  read(path: string): Promise<string> {
    return readFile(this.abs(path), 'utf8');
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const bytes = await readFile(this.abs(path));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  private abs(path: string): string {
    return join(this.rootDir, path);
  }
}
