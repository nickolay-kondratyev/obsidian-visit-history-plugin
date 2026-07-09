import { TFile } from 'obsidian';
import { DocIdStore, DocIdValues } from './DocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { FrontmatterUtil } from '../../util/file/frontmatter/FrontmatterUtil';
import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';

const FRONTMATTER_ID_KEY = 'id';

// Leading YAML frontmatter block: '---' on the first line up to the closing '---'.
const FRONTMATTER_BLOCK_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
// Top-level (unindented) `id:` entry inside the frontmatter block.
const FRONTMATTER_ID_LINE_REGEX = /^id\s*:\s*(.+)$/m;

/**
 * Doc id store for markdown-family notes (.md, incl. .excalidraw.md):
 * the id lives in the YAML frontmatter under the 'id' key.
 */
export class FrontmatterDocIdStore implements DocIdStore {
  constructor(
    private readonly frontmatterUtil: FrontmatterUtil,
    private readonly noteFileUtil: NoteFileUtil,
    private readonly docIdGenerator: DocIdGenerator,
  ) {
  }

  async ensureId(file: TFile): Promise<string | null> {
    // Fast path: an existing id means NO write at all. processFrontMatter
    // re-serializes the whole frontmatter block, so we must not reach it
    // when the id is already present (mtime churn, YAML reformatting).
    const existingId = this.readIdFromRawContent(await this.noteFileUtil.cachedRead(file));
    if (existingId !== null) {
      return existingId;
    }

    let resultId: string | null = null;
    await this.frontmatterUtil.processFrontMatter(file, (frontmatter) => {
      // Re-check on the parsed frontmatter: the raw-text fast path is a
      // heuristic and must never cause an existing id to be overwritten
      // (e.g. exotic YAML the regex missed).
      const existing = DocIdValues.read(frontmatter[FRONTMATTER_ID_KEY]);
      if (existing.kind === 'present') {
        resultId = existing.id;
        return;
      }
      resultId = this.docIdGenerator.generate();
      frontmatter[FRONTMATTER_ID_KEY] = resultId;
    });
    return resultId;
  }

  /** Extracts a top-level frontmatter `id` value from raw note text, or null. */
  private readIdFromRawContent(content: string): string | null {
    const block = FRONTMATTER_BLOCK_REGEX.exec(content);
    if (!block?.[1]) {
      return null;
    }
    const idLine = FRONTMATTER_ID_LINE_REGEX.exec(block[1]);
    if (!idLine?.[1]) {
      return null;
    }
    // Strip surrounding YAML quotes ("..." or '...') if present.
    const value = idLine[1].trim().replace(/^(["'])(.*)\1$/, '$2');
    return value.length > 0 ? value : null;
  }
}
