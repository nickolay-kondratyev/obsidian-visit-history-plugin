import { App, normalizePath } from 'obsidian';
import { HiddenFileUtil } from '../HiddenFileUtil';

/**
 * DataAdapter-backed HiddenFileUtil. See the interface for WHY the adapter
 * (not the Vault API) is used for all VH data paths.
 */
export class HiddenFileUtilDefault implements HiddenFileUtil {
  constructor(private readonly app: App) {
  }

  async readIfExists(filePath: string): Promise<string | null> {
    const path = normalizePath(filePath);
    if (!(await this.app.vault.adapter.exists(path))) {
      return null;
    }
    return this.app.vault.adapter.read(path);
  }

  async write(filePath: string, content: string): Promise<void> {
    const path = normalizePath(filePath);
    await this.ensureParentFolders(path);
    await this.app.vault.adapter.write(path, content);
  }

  async append(filePath: string, content: string): Promise<void> {
    const path = normalizePath(filePath);
    await this.ensureParentFolders(path);
    // WHY not adapter.append on a missing file: create-on-append is not a
    // documented DataAdapter guarantee across platforms (desktop vs mobile),
    // so absence is handled explicitly.
    if (await this.app.vault.adapter.exists(path)) {
      await this.app.vault.adapter.append(path, content);
    } else {
      await this.app.vault.adapter.write(path, content);
    }
  }

  async listSubfolderNames(folderPath: string): Promise<string[]> {
    const path = normalizePath(folderPath);
    if (!(await this.app.vault.adapter.exists(path))) {
      return [];
    }
    const listed = await this.app.vault.adapter.list(path);
    // adapter.list returns full vault-relative paths — reduce to basenames.
    return listed.folders.map(fullPath => fullPath.slice(fullPath.lastIndexOf('/') + 1));
  }

  async exists(path: string): Promise<boolean> {
    return this.app.vault.adapter.exists(normalizePath(path));
  }

  async rename(fromPath: string, toPath: string): Promise<void> {
    const from = normalizePath(fromPath);
    const to = normalizePath(toPath);
    // DataAdapter.rename's behavior on an existing destination is not a
    // documented guarantee across platforms — fail loudly instead.
    if (await this.app.vault.adapter.exists(to)) {
      throw new Error(`Rename destination already exists toPath=[${to}]`);
    }
    await this.ensureParentFolders(to);
    await this.app.vault.adapter.rename(from, to);
  }

  // ── private ─────────────────────────────────────────────────────────────

  /** Creates every missing folder segment above the file. */
  private async ensureParentFolders(normalizedFilePath: string): Promise<void> {
    const segments = normalizedFilePath.split('/').slice(0, -1);
    let currentPath = '';
    for (const segment of segments) {
      currentPath = currentPath === '' ? segment : `${currentPath}/${segment}`;
      if (!(await this.app.vault.adapter.exists(currentPath))) {
        await this.app.vault.adapter.mkdir(currentPath);
      }
    }
  }
}
