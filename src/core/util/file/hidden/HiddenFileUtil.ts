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

  /** True when a file OR folder exists at the path. */
  exists(path: string): Promise<boolean>;

  /**
   * Moves a file or folder (with its whole subtree), creating the
   * destination's parent folders as needed. Throws when the destination
   * already exists — callers must check first (never merges).
   */
  rename(fromPath: string, toPath: string): Promise<void>;
}
