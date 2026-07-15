import { TFile } from 'obsidian';
import { DocIdStore, DocIdValues, ExistingIdState } from './DocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';

const FRONTMATTER_ID_KEY = 'id';
// Obsidian serializes .canvas JSON with tab indentation — match it on write.
const CANVAS_JSON_INDENT = '\t';

/**
 * Doc id store for .canvas files: the id lives in the canvas JSON under
 * metadata.frontmatter.id. Missing metadata/frontmatter objects are created.
 * Empty/whitespace-only content is treated as an empty canvas ({}) — a
 * brand-new canvas is a 0-byte file and gets an id on first focus.
 * Malformed canvas JSON never throws — returns null (one bad file must not
 * break focus handling).
 */
export class CanvasDocIdStore implements DocIdStore {
  constructor(
    private readonly noteFileUtil: NoteFileUtil,
    private readonly docIdGenerator: DocIdGenerator,
  ) {
  }

  async ensureId(file: TFile): Promise<string | null> {
    const canvas = this.parseCanvas(await this.noteFileUtil.cachedRead(file), file.path);
    if (canvas === null) {
      return null;
    }

    const existing = this.readIdState(canvas);
    if (existing.kind === 'present') {
      return existing.id;
    }

    const newId = this.docIdGenerator.generate();
    await this.noteFileUtil.process(file, (content) => {
      // Re-parse inside the atomic read-modify-write: the content may have
      // changed since the precheck read (and may have gained an id).
      const current = this.parseCanvas(content, file.path);
      if (current === null || this.readIdState(current).kind === 'present') {
        return content;
      }
      this.writeId(current, newId);
      return JSON.stringify(current, null, CANVAS_JSON_INDENT);
    });
    return newId;
  }

  async getId(file: TFile): Promise<string | null> {
    const canvas = this.parseCanvas(await this.noteFileUtil.cachedRead(file), file.path);
    if (canvas === null) {
      return null;
    }
    const existing = this.readIdState(canvas);
    return existing.kind === 'present' ? existing.id : null;
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private parseCanvas(content: string, path: string): Record<string, unknown> | null {
    // A brand-new canvas is created by Obsidian as an EMPTY file — treat
    // empty/whitespace-only content as an empty canvas object so it can
    // receive a doc id on first focus (not as malformed JSON).
    if (content.trim() === '') {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(content);
      if (this.isRecord(parsed)) {
        return parsed;
      }
      console.error(`[VHP][CanvasDocIdStore] canvas root is not an object path=[${path}]`);
      return null;
    } catch (error) {
      console.error(`[VHP][CanvasDocIdStore] malformed canvas JSON path=[${path}]`, error);
      return null;
    }
  }

  private readIdState(canvas: Record<string, unknown>): ExistingIdState {
    const metadata = canvas['metadata'];
    if (!this.isRecord(metadata)) {
      return { kind: 'absent' };
    }
    const frontmatter = metadata['frontmatter'];
    if (!this.isRecord(frontmatter)) {
      return { kind: 'absent' };
    }
    return DocIdValues.read(frontmatter[FRONTMATTER_ID_KEY]);
  }

  /** Sets metadata.frontmatter.id, creating the intermediate objects if absent. */
  private writeId(canvas: Record<string, unknown>, id: string): void {
    const metadata = this.isRecord(canvas['metadata']) ? canvas['metadata'] : {};
    canvas['metadata'] = metadata;
    const frontmatter = this.isRecord(metadata['frontmatter']) ? metadata['frontmatter'] : {};
    metadata['frontmatter'] = frontmatter;
    frontmatter[FRONTMATTER_ID_KEY] = id;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
