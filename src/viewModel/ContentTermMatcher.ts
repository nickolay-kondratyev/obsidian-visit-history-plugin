import type { NoteFileUtil } from '../core/util/file/note/NoteFileUtil';
import type { VaultUtil } from '../core/util/vault/VaultUtil';

/**
 * Resolves the heatmap's CONTENT filter terms to the set of matching files.
 *
 * The React view depends on this interface only (injected as an App prop,
 * like IFileOpener/HeatmapConfigStore) — the tree filter itself
 * ({@link import('./filterVaultTree').filterVaultTree}) stays a pure sync
 * function consuming the resolved path set.
 */
export interface ContentTermMatcher {
  /**
   * Vault paths of tracked files whose content contains ANY of the terms
   * (case-insensitive substring). Empty `terms` → empty set, no file reads.
   */
  findPathsMatchingAnyTerm(terms: readonly string[]): Promise<ReadonlySet<string>>;
}

/**
 * Default implementation on core seams: enumerates tracked files via
 * {@link VaultUtil.getTrackedTFiles} (no last-visit resolution — pure waste
 * here) and reads content via Obsidian's cache-backed `cachedRead`.
 *
 * A file whose read fails is logged once and treated as a NON-match —
 * one bad file must never break filtering ("malformed files never throw").
 *
 * No persistent index/cache: term changes are rare, discrete user actions
 * (see docs/tickets/content-match-performance.md for the large-vault plan).
 */
export class ContentTermMatcherDefault implements ContentTermMatcher {
  constructor(
    private readonly vaultUtil: VaultUtil,
    private readonly noteFileUtil: NoteFileUtil,
  ) {}

  async findPathsMatchingAnyTerm(terms: readonly string[]): Promise<ReadonlySet<string>> {
    const loweredTerms = terms.map(t => t.toLowerCase()).filter(t => t.length > 0);
    if (loweredTerms.length === 0) return new Set();

    const matched = new Set<string>();
    await Promise.all(
      this.vaultUtil.getTrackedTFiles().map(async file => {
        try {
          const content = (await this.noteFileUtil.cachedRead(file)).toLowerCase();
          if (loweredTerms.some(t => content.includes(t))) {
            matched.add(file.path);
          }
        } catch (error) {
          console.error(
            `ContentTermMatcher: read failed, treating as non-match path=[${file.path}]`,
            error,
          );
        }
      }),
    );
    return matched;
  }
}
