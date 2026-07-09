import { TFile } from 'obsidian';

// INoteFileManager.ts

export interface NoteFileUtil {
  /**
   * Creates a new note at the given vault path with optional initial content.
   * Throws if the file already exists.
   */
  createNote(filePathInVault: string, initialContent?: string): Promise<TFile>;

  /**
   * Appends content to an existing note. Throws if the file does not exist.
   */
  appendLineToNote(existingFilePathInVault: string, contentToAppend: string): Promise<void>;

  cachedRead(file: TFile): Promise<string>;

  /**
   * Atomically reads, transforms, and saves a file's content
   * (Obsidian Vault.process — avoids the read()+modify() race).
   */
  process(file: TFile, transform: (content: string) => string): Promise<void>;
}