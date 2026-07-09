import { App, TFile } from 'obsidian';

// ── LinkUtil ──────────────────────────────────────────────────────────────────

export interface LinkUtil {
  /**
   * Resolves wiki-link text (e.g. "notes/target.md" or a shortest-unique
   * name like "target") to its target file, as Obsidian itself would when
   * the link appears in the given source file. Null when unresolvable.
   */
  resolveLinkTarget(linkText: string, sourcePath: string): TFile | null;
}

// ── ObsidianLinkUtil ──────────────────────────────────────────────────────────

/** Obsidian implementation of LinkUtil, backed by the metadata cache. */
export class LinkUtilDefault implements LinkUtil {
  constructor(private readonly app: App) {
  }

  resolveLinkTarget(linkText: string, sourcePath: string): TFile | null {
    return this.app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
  }
}
