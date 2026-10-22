import { MetadataCache, TFile, Vault } from 'obsidian';
import { NoteReference } from './NoteReference';
import { CanvasReferenceScanner } from './CanvasReferenceScanner';

/** Finds every reference to a note across the whole vault. */
export interface NoteReferenceCollector {
  collectReferencesTo(target: TFile): Promise<NoteReference[]>;
}

/** The slices of Obsidian's Vault / MetadataCache the collector reads. */
export type CollectorVault = Pick<Vault, 'getMarkdownFiles' | 'getFiles' | 'cachedRead'>;
export type CollectorMetadataCache = Pick<MetadataCache, 'getFileCache' | 'getFirstLinkpathDest'>;

const CANVAS_EXTENSION = 'canvas';

/**
 * metadataCache-backed collector: body links, embeds and frontmatter
 * property links of every markdown file (incl. `.excalidraw.md`), plus our
 * own scan of every canvas (metadataCache does not index canvases).
 *
 * Full vault walk per call — fine for an on-demand user action (cache
 * lookups + one cachedRead per canvas). Raw `.excalidraw` JSON drawings are
 * not scanned (no known link format) — accepted ceiling.
 * Self-links are NOT filtered here (InlineEligibility owns that rule).
 */
export class NoteReferenceCollectorDefault implements NoteReferenceCollector {
  constructor(
    private readonly vault: CollectorVault,
    private readonly metadataCache: CollectorMetadataCache,
  ) {
  }

  async collectReferencesTo(target: TFile): Promise<NoteReference[]> {
    const references: NoteReference[] = [];
    for (const sourceFile of this.vault.getMarkdownFiles()) {
      references.push(...this.markdownReferences(sourceFile, target));
    }
    for (const canvasFile of this.vault.getFiles().filter(file => file.extension === CANVAS_EXTENSION)) {
      const canvasJson = await this.vault.cachedRead(canvasFile);
      references.push(...CanvasReferenceScanner.scan(
        canvasFile,
        canvasJson,
        target.path,
        (linkpath, sourcePath) => this.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)?.path ?? null,
      ));
    }
    return references;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private markdownReferences(sourceFile: TFile, target: TFile): NoteReference[] {
    const cache = this.metadataCache.getFileCache(sourceFile);
    if (cache === null) {
      return [];
    }
    const references: NoteReference[] = [];
    const bodyLinks = [
      ...(cache.links ?? []).map(link => ({ link, isEmbed: false })),
      ...(cache.embeds ?? []).map(link => ({ link, isEmbed: true })),
    ];
    for (const { link, isEmbed } of bodyLinks) {
      const { linkpath, subpath } = NoteReferenceCollectorDefault.splitLinktext(link.link);
      if (this.resolvesTo(linkpath, sourceFile, target)) {
        references.push({
          kind: 'body',
          sourceFile,
          isEmbed,
          subpath,
          original: link.original,
          startOffset: link.position.start.offset,
          endOffset: link.position.end.offset,
        });
      }
    }
    for (const link of cache.frontmatterLinks ?? []) {
      const { linkpath } = NoteReferenceCollectorDefault.splitLinktext(link.link);
      if (this.resolvesTo(linkpath, sourceFile, target)) {
        references.push({ kind: 'property', sourceFile, propertyKey: link.key });
      }
    }
    return references;
  }

  private resolvesTo(linkpath: string, sourceFile: TFile, target: TFile): boolean {
    // `[[#Heading]]` (empty path) points at the source note itself.
    const resolvedPath = linkpath === ''
      ? sourceFile.path
      : this.metadataCache.getFirstLinkpathDest(linkpath, sourceFile.path)?.path;
    return resolvedPath === target.path;
  }

  /**
   * Splits a cached linktext (`path#subpath`). WHAT: mirrors Obsidian's
   * parseLinktext (split at the first `#`) — not imported so this stays
   * unit-testable without the runtime 'obsidian' module.
   */
  private static splitLinktext(linktext: string): { linkpath: string; subpath: string } {
    const hashIndex = linktext.indexOf('#');
    return hashIndex < 0
      ? { linkpath: linktext, subpath: '' }
      : { linkpath: linktext.slice(0, hashIndex), subpath: linktext.slice(hashIndex) };
  }
}
