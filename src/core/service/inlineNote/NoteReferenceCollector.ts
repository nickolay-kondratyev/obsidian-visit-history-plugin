import { CachedMetadata, MetadataCache, TFile, Vault } from 'obsidian';
import { NoteReference } from './NoteReference';
import { CanvasReferenceScanner } from './CanvasReferenceScanner';

/** Every reference to a note — or none at all when the index can't be trusted yet. */
export type ReferenceCensus =
  | { readonly kind: 'complete'; readonly references: readonly NoteReference[] }
  /** Some markdown file has no metadataCache entry yet (e.g. right after startup): its links are unknown. */
  | { readonly kind: 'index-incomplete' };

/** Finds every reference to a note across the whole vault. */
export interface NoteReferenceCollector {
  collectReferencesTo(target: TFile): Promise<ReferenceCensus>;
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
 * A markdown file without a cache entry makes the census incomplete — a
 * link missed there would break once the note is trashed, so we never guess.
 */
export class NoteReferenceCollectorDefault implements NoteReferenceCollector {
  constructor(
    private readonly vault: CollectorVault,
    private readonly metadataCache: CollectorMetadataCache,
  ) {
  }

  async collectReferencesTo(target: TFile): Promise<ReferenceCensus> {
    const references: NoteReference[] = [];
    for (const sourceFile of this.vault.getMarkdownFiles()) {
      const cache = this.metadataCache.getFileCache(sourceFile);
      if (cache === null) {
        return { kind: 'index-incomplete' };
      }
      references.push(...this.markdownReferences(sourceFile, cache, target));
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
    return { kind: 'complete', references };
  }

  // ── private ─────────────────────────────────────────────────────────────

  private markdownReferences(sourceFile: TFile, cache: CachedMetadata, target: TFile): NoteReference[] {
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
