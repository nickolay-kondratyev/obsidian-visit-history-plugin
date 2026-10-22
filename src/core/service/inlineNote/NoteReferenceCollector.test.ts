import { describe, expect, it } from 'vitest';
import { CachedMetadata, LinkCache, TFile } from 'obsidian';
import { CollectorMetadataCache, CollectorVault, NoteReferenceCollectorDefault } from './NoteReferenceCollector';
import { NoteReference } from './NoteReference';
import { makeTFile } from '../../../testSupport/fileFactory';

const NOTE1 = makeTFile({ path: 'note1.md' });
const NOTE2 = makeTFile({ path: 'sub/note2.md' });
const CANVAS = makeTFile({ path: 'board.canvas' });

function linkCache(link: string, original: string, startOffset: number): LinkCache {
  return {
    link,
    original,
    position: {
      start: { line: 0, col: startOffset, offset: startOffset },
      end: { line: 0, col: startOffset + original.length, offset: startOffset + original.length },
    },
  };
}

/**
 * In-memory vault + metadataCache: names resolve by basename. Every markdown
 * file is indexed (empty metadata by default) unless listed as unindexed.
 */
class FakeVaultIndex implements CollectorVault, CollectorMetadataCache {
  private readonly files: TFile[] = [NOTE1, NOTE2, CANVAS];
  readonly metadataByPath = new Map<string, CachedMetadata>();
  readonly unindexedPaths = new Set<string>();
  readonly contentByPath = new Map<string, string>();

  getMarkdownFiles(): TFile[] {
    return this.files.filter(file => file.extension === 'md');
  }

  getFiles(): TFile[] {
    return [...this.files];
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.contentByPath.get(file.path) ?? '';
  }

  getFileCache(file: TFile): CachedMetadata | null {
    return this.unindexedPaths.has(file.path) ? null : this.metadataByPath.get(file.path) ?? {};
  }

  getFirstLinkpathDest(linkpath: string, _sourcePath: string): TFile | null {
    return this.files.find(file => file.basename === linkpath || file.path === linkpath) ?? null;
  }
}

function setup(): { index: FakeVaultIndex; collector: NoteReferenceCollectorDefault } {
  const index = new FakeVaultIndex();
  return { index, collector: new NoteReferenceCollectorDefault(index, index) };
}

/** The references of a complete census (throws when the index is incomplete). */
async function referencesTo(collector: NoteReferenceCollectorDefault, target: TFile): Promise<readonly NoteReference[]> {
  const census = await collector.collectReferencesTo(target);
  if (census.kind !== 'complete') throw new Error(`expected complete census, got kind=[${census.kind}]`);
  return census.references;
}

describe('NoteReferenceCollectorDefault', () => {
  describe('collectReferencesTo', () => {
    it('should report a body link with its offsets and original text', async () => {
      // GIVEN note1 linking note2 at offset 4
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE1.path, { links: [linkCache('note2', '[[note2|alias]]', 4)] });
      // WHEN collected
      // THEN the body reference carries what placement needs
      expect(await referencesTo(collector, NOTE2)).toEqual([{
        kind: 'body', sourceFile: NOTE1, isEmbed: false, subpath: '',
        original: '[[note2|alias]]', startOffset: 4, endOffset: 19,
      }]);
    });

    it('should mark embeds', async () => {
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE1.path, { embeds: [linkCache('note2', '![[note2]]', 0)] });
      const [reference] = await referencesTo(collector, NOTE2);
      expect(reference?.kind === 'body' && reference.isEmbed).toBe(true);
    });

    it('should keep the subpath of a partial link', async () => {
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE1.path, { links: [linkCache('note2#Heading', '[[note2#Heading]]', 0)] });
      const [reference] = await referencesTo(collector, NOTE2);
      expect(reference?.kind === 'body' && reference.subpath).toBe('#Heading');
    });

    it('should report a frontmatter property link with its key', async () => {
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE1.path, { frontmatterLinks: [{ key: 'related', link: 'note2', original: '[[note2]]' }] });
      expect(await referencesTo(collector, NOTE2))
        .toEqual([{ kind: 'property', sourceFile: NOTE1, propertyKey: 'related' }]);
    });

    it('should report canvas file cards', async () => {
      const { index, collector } = setup();
      index.contentByPath.set(CANVAS.path, JSON.stringify({ nodes: [{ id: '1', type: 'file', file: NOTE2.path }] }));
      expect(await referencesTo(collector, NOTE2))
        .toEqual([{ kind: 'canvas', sourceFile: CANVAS, subpath: '' }]);
    });

    it('should resolve canvas text card links through the metadata cache', async () => {
      const { index, collector } = setup();
      index.contentByPath.set(CANVAS.path, JSON.stringify({ nodes: [{ id: '1', type: 'text', text: 'see [[note2]]' }] }));
      expect(await referencesTo(collector, NOTE2)).toHaveLength(1);
    });

    it('should ignore links resolving to other notes', async () => {
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE2.path, { links: [linkCache('note1', '[[note1]]', 0)] });
      expect(await referencesTo(collector, NOTE2)).toEqual([]);
    });

    it('should treat a same-note heading link as pointing at its own note', async () => {
      // GIVEN note2 linking one of its own headings
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE2.path, { links: [linkCache('#Part', '[[#Part]]', 0)] });
      // WHEN collected for note2
      // THEN it is reported as a (self) reference from note2
      expect((await referencesTo(collector, NOTE2))[0]?.sourceFile).toBe(NOTE2);
    });

    it('should report an incomplete index when a markdown file has no cache entry yet', async () => {
      // GIVEN note1 not indexed by Obsidian yet (e.g. right after startup)
      const { index, collector } = setup();
      index.unindexedPaths.add(NOTE1.path);
      // WHEN collected
      // THEN the census says its links are unknown instead of missing them
      expect((await collector.collectReferencesTo(NOTE2)).kind).toBe('index-incomplete');
    });

    it('should count every link of a file separately', async () => {
      const { index, collector } = setup();
      index.metadataByPath.set(NOTE1.path, {
        links: [linkCache('note2', '[[note2]]', 0)],
        embeds: [linkCache('note2', '![[note2]]', 20)],
      });
      expect(await referencesTo(collector, NOTE2)).toHaveLength(2);
    });
  });
});
