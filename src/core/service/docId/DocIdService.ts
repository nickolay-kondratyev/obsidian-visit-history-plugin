import { TFile } from 'obsidian';
import { DocIdStore } from './DocIdStore';

/**
 * Ensures every opened document carries a persistent doc id
 * (docid_{21 base62}_E). Dispatched from DocIdFocusListener on file focus.
 */
export interface DocIdService {
  /**
   * Returns the doc id for the file, generating and persisting one when
   * missing. An existing id is used as-is even if it does not follow the
   * docid_ format, and the file stays untouched.
   * Returns null for unsupported formats (e.g. raw .excalidraw JSON) or
   * unreadable content.
   */
  ensureDocId(file: TFile): Promise<string | null>;
}

export class DocIdServiceDefault implements DocIdService {
  private readonly storeByExtension: ReadonlyMap<string, DocIdStore>;

  constructor(frontmatterDocIdStore: DocIdStore, canvasDocIdStore: DocIdStore) {
    this.storeByExtension = new Map<string, DocIdStore>([
      // 'md' covers Excalidraw's .excalidraw.md files too (extension is 'md').
      ['md', frontmatterDocIdStore],
      ['canvas', canvasDocIdStore],
      // WHY-NOT 'excalidraw': raw .excalidraw files are pure JSON with no
      // frontmatter concept and no agreed id location — intentionally skipped
      // (owner decision).
    ]);
  }

  async ensureDocId(file: TFile): Promise<string | null> {
    const store = this.storeByExtension.get(file.extension);
    if (!store) {
      return null;
    }
    return store.ensureId(file);
  }
}
