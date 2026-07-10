import { HiddenFileUtil } from '../core/util/file/hidden/HiddenFileUtil';

/**
 * In-memory HiddenFileUtil for unit tests. Mirrors the contract of
 * HiddenFileUtilDefault (append creates the file; folders are implied by
 * the file paths that exist under them).
 */
export class FakeHiddenFileUtil implements HiddenFileUtil {
  private readonly contentByPath = new Map<string, string>();

  /** Seeds a file directly. */
  seedFile(path: string, content: string): void {
    this.contentByPath.set(path, content);
  }

  getContent(path: string): string | undefined {
    return this.contentByPath.get(path);
  }

  allPaths(): string[] {
    return [...this.contentByPath.keys()];
  }

  async readIfExists(filePath: string): Promise<string | null> {
    return this.contentByPath.get(filePath) ?? null;
  }

  async write(filePath: string, content: string): Promise<void> {
    this.contentByPath.set(filePath, content);
  }

  async append(filePath: string, content: string): Promise<void> {
    this.contentByPath.set(filePath, (this.contentByPath.get(filePath) ?? '') + content);
  }

  async exists(path: string): Promise<boolean> {
    if (this.contentByPath.has(path)) {
      return true;
    }
    // Folders are implied by the files under them.
    const prefix = `${path}/`;
    return [...this.contentByPath.keys()].some(filePath => filePath.startsWith(prefix));
  }

  async rename(fromPath: string, toPath: string): Promise<void> {
    if (await this.exists(toPath)) {
      throw new Error(`Rename destination already exists toPath=[${toPath}]`);
    }
    const fromPrefix = `${fromPath}/`;
    for (const [path, content] of [...this.contentByPath.entries()]) {
      const movedPath = path === fromPath
        ? toPath
        : path.startsWith(fromPrefix) ? toPath + '/' + path.slice(fromPrefix.length) : null;
      if (movedPath !== null) {
        this.contentByPath.delete(path);
        this.contentByPath.set(movedPath, content);
      }
    }
  }

  async listSubfolderNames(folderPath: string): Promise<string[]> {
    const prefix = `${folderPath}/`;
    const names = new Set<string>();
    for (const path of this.contentByPath.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slashIndex = rest.indexOf('/');
      if (slashIndex > 0) {
        names.add(rest.slice(0, slashIndex));
      }
    }
    return [...names];
  }
}
