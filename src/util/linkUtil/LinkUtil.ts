import { App, TFile } from 'obsidian';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Backlink {
  file: TFile;
  path: string;   // e.g. "folder/note.md"
  title: string;  // display name without extension
}

// ── LinkUtil ──────────────────────────────────────────────────────────────────

export interface LinkUtil {
  getBacklinks(file: TFile): Backlink[];
}

// ── ObsidianLinkUtil ──────────────────────────────────────────────────────────

/**
 * Obsidian implementation of LinkUtil. Uses metadataCache to resolve backlinks
 * from the vault's link index.
 */
export class LinkUtilDefault implements LinkUtil {
  constructor(private readonly app: App) {
  }

  /**
   * Returns all files that link to the given file.
   * Returns an empty array if the file has no backlinks or has not yet been
   * indexed by the metadata cache.
   */
  getBacklinks(file: TFile): Backlink[] {
    return Object.entries(this.app.metadataCache.resolvedLinks)
      .filter(([_sourcePath, destinations]) => file.path in destinations)
      .flatMap(([sourcePath]) => {
        const sourceFile = this.app.vault.getFileByPath(sourcePath);
        if (!sourceFile) return [];

        return [{
          file: sourceFile,
          path: sourceFile.path,
          title: sourceFile.basename,
        }];
      });
  }
}