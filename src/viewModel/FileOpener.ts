import { App } from 'obsidian';

/**
 * Abstraction for opening a vault file by its path.
 *
 * The view components depend on this interface — never on Obsidian APIs directly.
 * The Obsidian-specific wiring lives in ObsidianFileOpener and is created
 * in VaultTreemapView (the boundary between Obsidian and React).
 */
export interface IFileOpener {
  /**
   * Open a file in Obsidian's active leaf.
   * @param path — full vault path, e.g. "Projects/Alpha/overview.md"
   */
  openFile(path: string): void;
}

/**
 * Obsidian-backed implementation of {@link IFileOpener}.
 *
 * Wraps `app.workspace.openLinkText()`.
 * Constructed in VaultTreemapView with the Obsidian App instance.
 */
export class ObsidianFileOpener implements IFileOpener {
  constructor(private readonly app: App) {}

  openFile(path: string): void {
    // openLinkText(path, sourcePath, newLeaf):
    //   path       — full vault path to the file
    //   '/'        — source path for relative link resolution (vault root)
    //   false      — open in current leaf, not a new split
    void this.app.workspace.openLinkText(path, '/', false);
  }
}
