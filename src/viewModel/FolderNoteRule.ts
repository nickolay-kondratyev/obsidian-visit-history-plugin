/**
 * Decides whether a file is a FOLDER NOTE — the note that describes its own
 * folder. Convention: the file's name (minus its final extension) equals its
 * parent folder's name, e.g. `Projects/Alpha/Alpha.md` → folder `Projects/Alpha`
 * (the default of the popular "Folder notes" plugins; works for `.canvas` too).
 *
 * Pure (Obsidian-free) — works on vault-relative paths.
 *
 * Ceiling (deliberate): other conventions — a sibling `Alpha.md` NEXT TO the
 * `Alpha/` folder, `index.md`/`README.md`, `Alpha.excalidraw.md` — are not
 * recognized. Upgrade path: add them here; the heatmap follow wiring is unaffected.
 */
export class FolderNoteRule {
  /**
   * @returns The vault-relative folder path the file is the folder note of,
   *          or undefined when it is not a folder note (incl. vault-root files).
   */
  static folderPathOf(filePath: string): string | undefined {
    const segments = filePath.split('/');
    const fileName = segments.at(-1);
    const folderName = segments.at(-2);
    if (fileName === undefined || folderName === undefined) return undefined;
    return FolderNoteRule.stripExtension(fileName) === folderName
      ? segments.slice(0, -1).join('/')
      : undefined;
  }

  private static stripExtension(fileName: string): string {
    const dotIdx = fileName.lastIndexOf('.');
    // dotIdx 0 = a dotfile like ".md" — its whole name is the stem.
    return dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  }
}
