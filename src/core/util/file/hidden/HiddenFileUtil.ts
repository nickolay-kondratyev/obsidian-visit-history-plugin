/**
 * File I/O for HIDDEN vault paths — dot-folders like `.visit_history/`.
 *
 * WHY this exists: Obsidian's Vault API (getFiles, getAbstractFileByPath,
 * create, process, metadataCache) does NOT see dot-folders. All access to
 * hidden paths must go through the DataAdapter, which this interface wraps.
 * Keeping it as a seam lets everything above stay Obsidian-agnostic and
 * unit-testable (FakeHiddenFileUtil).
 *
 * All paths are vault-relative (e.g. ".visit_history/v2/...").
 */
export interface HiddenFileUtil {
  /** File content, or null when the file does not exist. */
  readIfExists(filePath: string): Promise<string | null>;

  /** Writes (creates or overwrites) a file, creating parent folders as needed. */
  write(filePath: string, content: string): Promise<void>;

  /**
   * Appends to a file, creating it (and parent folders) when absent.
   */
  append(filePath: string, content: string): Promise<void>;

  /**
   * Basenames of the direct subfolders of a folder.
   * Returns [] when the folder does not exist.
   */
  listSubfolderNames(folderPath: string): Promise<string[]>;
}
