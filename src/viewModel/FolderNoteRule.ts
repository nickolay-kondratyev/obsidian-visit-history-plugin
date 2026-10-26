/** Whether a vault-relative path is an existing folder (Obsidian-backed at the call site). */
export type IsFolderPath = (path: string) => boolean;

/**
 * Decides whether a file is a FOLDER NOTE — the note that describes a folder.
 * Two conventions (those of the popular "Folder notes" plugins; `.canvas` too):
 * - INSIDE: named like its parent folder — `Projects/Alpha/Alpha.md` → `Projects/Alpha`.
 * - SIBLING: named like an existing folder next to it — `Projects/Alpha.md`
 *   beside `Projects/Alpha/` → `Projects/Alpha` (incl. vault root: `Alpha.md` → `Alpha`).
 * When both apply (`Alpha/Alpha.md` AND a folder `Alpha/Alpha/`), INSIDE wins.
 *
 * Pure (Obsidian-free) — works on vault-relative paths; folder existence is
 * asked through `isFolder`.
 *
 * Ceiling (deliberate): `index.md`/`README.md` and `Alpha.excalidraw.md` folder
 * notes are not recognized. Upgrade path: add them here; the heatmap follow
 * wiring is unaffected.
 */
export class FolderNoteRule {
  /**
   * @returns The vault-relative folder path the file is the folder note of,
   *          or undefined when it is not a folder note.
   */
  static folderPathOf(filePath: string, isFolder: IsFolderPath): string | undefined {
    const segments = filePath.split('/');
    const fileName = segments.at(-1);
    if (fileName === undefined) return undefined;
    const stem = FolderNoteRule.stripExtension(fileName);
    const parentSegments = segments.slice(0, -1);
    // INSIDE needs no existence check — the parent folder holds the file.
    if (parentSegments.at(-1) === stem) return parentSegments.join('/');
    const siblingFolderPath = [...parentSegments, stem].join('/');
    return isFolder(siblingFolderPath) ? siblingFolderPath : undefined;
  }

  private static stripExtension(fileName: string): string {
    const dotIdx = fileName.lastIndexOf('.');
    // dotIdx 0 = a dotfile like ".md" — its whole name is the stem.
    return dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  }
}
