import { TFile } from 'obsidian';

/**
 * Reads/creates the persistent doc id inside one specific file format.
 * Implementations: FrontmatterDocIdStore (md), CanvasDocIdStore (canvas).
 */
export interface DocIdStore {
  /**
   * Returns the document's id, generating and persisting a new one if absent.
   * An existing id is returned as-is (even if it does not follow the docid_
   * format) and the file is NOT modified.
   * Returns null when the file content cannot be handled (e.g. malformed
   * JSON) — never throws for content problems.
   */
  ensureId(file: TFile): Promise<string | null>;

  /**
   * READ-ONLY id lookup: returns the existing usable id, or null when the
   * id is absent, unusable (occupied slot), or the content cannot be handled.
   * NEVER writes — safe for bulk read paths (e.g. heatmap aggregation).
   */
  getId(file: TFile): Promise<string | null>;
}

/**
 * State of an id value found in a document.
 * 'present' with id=null means SOMETHING occupies the id slot (e.g. an
 * object) — it is unusable as an id but must never be overwritten.
 */
export type ExistingIdState =
  | { kind: 'absent' }
  | { kind: 'present'; id: string | null };

export class DocIdValues {
  /** Classifies a raw id value read from frontmatter / canvas JSON. */
  static read(value: unknown): ExistingIdState {
    if (value === undefined || value === null || value === '') {
      return { kind: 'absent' };
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return { kind: 'present', id: String(value) };
    }
    return { kind: 'present', id: null };
  }
}
