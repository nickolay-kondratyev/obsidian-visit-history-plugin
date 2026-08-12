/**
 * File I/O for the plugin's own data paths (outside the tracked note space),
 * wrapping Obsidian's DataAdapter.
 *
 * WHY the DataAdapter (not the Vault API): Obsidian's Vault API (getFiles,
 * getAbstractFileByPath, create, process, metadataCache) does NOT see
 * dot-folders, and the VH top dir is the dot-hidden `.plugin_data/visit_history/`
 * (see VhUserPaths.TOP_DIR) — so the DataAdapter is required. It also reaches
 * legacy dot-dir paths (the rename/move migration sources) and visible folders
 * alike, so all VH I/O stays here. Keeping it as a seam lets everything above
 * stay Obsidian-agnostic and unit-testable (FakeHiddenFileUtil).
 *
 * All paths are vault-relative (e.g. ".plugin_data/visit_history/user/<user>/v3/...").
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

  /**
   * Basenames of the direct FILES in a folder.
   * Returns [] when the folder does not exist.
   */
  listFileNames(folderPath: string): Promise<string[]>;

  /**
   * Removes the folder ONLY when it holds no files and no subfolders.
   * Returns whether it was removed; no-op (false) when the folder is absent
   * or non-empty. Never recursive — never deletes content.
   */
  removeFolderIfEmpty(folderPath: string): Promise<boolean>;

  /** True when a file OR folder exists at the path. */
  exists(path: string): Promise<boolean>;

  /**
   * Moves a file or folder (with its whole subtree), creating the
   * destination's parent folders as needed. Throws when the destination
   * already exists — callers must check first (never merges).
   */
  rename(fromPath: string, toPath: string): Promise<void>;
}
