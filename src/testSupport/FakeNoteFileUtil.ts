import { TFile } from 'obsidian';
import { NoteFileUtil } from '../core/util/file/note/NoteFileUtil';
import { makeTFile } from './fileFactory';

/**
 * In-memory NoteFileUtil for unit tests. Mirrors the contract of
 * NoteFileUtilDefault (throws on duplicate create / missing append target).
 */
export class FakeNoteFileUtil implements NoteFileUtil {
  private readonly contentByPath = new Map<string, string>();
  /** Number of process() calls — lets tests assert the no-write fast path. */
  processCallCount = 0;

  /** Seeds a note directly, bypassing createNote's duplicate check. */
  seedNote(path: string, content: string): TFile {
    this.contentByPath.set(path, content);
    return makeTFile({ path });
  }

  getContent(path: string): string | undefined {
    return this.contentByPath.get(path);
  }

  /** Path of the first note whose content contains the fragment, or null. */
  findPathContaining(fragment: string): string | null {
    for (const [path, content] of this.contentByPath) {
      if (content.includes(fragment)) return path;
    }
    return null;
  }

  async createNote(filePathInVault: string, initialContent = ''): Promise<TFile> {
    if (this.contentByPath.has(filePathInVault)) {
      throw new Error(`File already exists at path: ${filePathInVault}`);
    }
    return this.seedNote(filePathInVault, initialContent);
  }

  async appendLineToNote(existingFilePathInVault: string, contentToAppend: string): Promise<void> {
    const current = this.contentByPath.get(existingFilePathInVault);
    if (current === undefined) {
      throw new Error(`File not found: ${existingFilePathInVault}`);
    }
    const leadingSeparator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
    const trailingSeparator = contentToAppend.endsWith('\n') ? '' : '\n';
    this.contentByPath.set(
      existingFilePathInVault,
      current + leadingSeparator + contentToAppend + trailingSeparator,
    );
  }

  async cachedRead(file: TFile): Promise<string> {
    const content = this.contentByPath.get(file.path);
    if (content === undefined) {
      throw new Error(`File not found: ${file.path}`);
    }
    return content;
  }

  async process(file: TFile, transform: (content: string) => string): Promise<void> {
    this.processCallCount++;
    const content = this.contentByPath.get(file.path);
    if (content === undefined) {
      throw new Error(`File not found: ${file.path}`);
    }
    this.contentByPath.set(file.path, transform(content));
  }
}
