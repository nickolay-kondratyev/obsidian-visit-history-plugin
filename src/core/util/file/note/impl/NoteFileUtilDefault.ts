// NoteFileManager.ts

import { App, TFile, normalizePath } from "obsidian";
import { NoteFileUtil } from "../NoteFileUtil";

export class NoteFileUtilDefault implements NoteFileUtil {
  constructor(private readonly app: App) {
  }

  async cachedRead(file: TFile): Promise<string> {
    return await this.app.vault.cachedRead(file);
  }

  /**
   * Creates a new note at the given vault path with optional initial content.
   * Intermediate folders are created automatically if they don't exist.
   * Throws if a file already exists at that path.
   */
  async createNote(filePathInVault: string, initialContent = ""): Promise<TFile> {
    console.log("[VHP] createNote", filePathInVault);

    const normalizedPath = normalizePath(filePathInVault);

    if (this.app.vault.getAbstractFileByPath(normalizedPath)) {
      throw new Error(`File already exists at path: ${normalizedPath}`);
    }

    // Ensure parent directories exist
    const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
    if (parentPath) {
      await this.ensureFolderExists(parentPath);
    }

    return this.app.vault.create(normalizedPath, initialContent);
  }

  /**
   * Appends content to an existing note.
   * Throws if no file exists at that path.
   */
  async appendLineToNote(existingFilePathInVault: string, contentToAppend: string): Promise<void> {
    const normalizedPath = normalizePath(existingFilePathInVault);
    const file = this.resolveExistingFile(normalizedPath);

    // vault.process is the preferred atomic read-modify-write API (Obsidian 1.3+).
    // It avoids the race condition of a separate read() + modify() pair.
    await this.app.vault.process(file, (currentContent) => {
      const leadingSeparator = currentContent.length > 0 && !currentContent.endsWith("\n") ? "\n" : "";
      const trailingSeparator = contentToAppend.endsWith("\n") ? "" : "\n";

      return currentContent + leadingSeparator + contentToAppend + trailingSeparator;
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolves a path to a TFile, throwing a descriptive error if it is absent
   * or is a folder rather than a file.
   */
  private resolveExistingFile(normalizedPath: string): TFile {
    const abstractFile = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!abstractFile) {
      throw new Error(`File not found: ${normalizedPath}`);
    }
    if (!(abstractFile instanceof TFile)) {
      throw new Error(`Path resolves to a folder, not a file: ${normalizedPath}`);
    }

    return abstractFile;
  }

  /**
   * Recursively ensures that a folder path exists in the vault,
   * creating any missing segments along the way.
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(folderPath)) {
      return; // Already exists
    }
    await this.app.vault.createFolder(folderPath);
  }
}