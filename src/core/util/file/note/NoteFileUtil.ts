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

  /** The file's raw bytes — no text decoding, so it is safe for any content. */
  readBinary(file: TFile): Promise<Uint8Array>;

  /**
   * Sets the file's modified time (epoch ms) WITHOUT changing its content:
   * re-reads the raw bytes and writes those very bytes back with `mtimeMs`,
   * only if `shouldWrite(bytes)` approves them (e.g. "still the committed
   * version"). Returns whether it wrote.
   */
  setModifiedTimeKeepingContent(
    file: TFile,
    mtimeMs: number,
    shouldWrite: (bytes: Uint8Array) => Promise<boolean>,
  ): Promise<boolean>;

  /**
   * Moves the file to the trash the normal Obsidian way (FileManager.trashFile
   * — respects the user's "Deleted files" setting).
   */
  trashFile(file: TFile): Promise<void>;
}
