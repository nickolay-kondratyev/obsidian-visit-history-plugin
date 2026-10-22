import type { MetadataCache, TFile } from 'obsidian';
import { PlainNoteCheck } from '../../core/service/inlineNote/PlainNoteCheck';

/** What the editor chrome knows about one rendered `![[...]]` embed. */
export interface EmbedFacts {
  /** The embed's linktext as written, without alias (`note2`, `note2#Heading`, `note2#^block`). */
  readonly src: string;
  /** Path of the note the embed is written in (its links resolve relative to it). */
  readonly sourcePath: string;
  /** Rendered inside ANOTHER embed's body — written in the embedded note, not this one. */
  readonly isNested: boolean;
  /** Rendered inside a canvas card (canvas cards get no inline icon). */
  readonly isInCanvas: boolean;
}

/** The slice of Obsidian's MetadataCache the rule reads. */
export type EmbedLinkIndex = Pick<MetadataCache, 'resolvedLinks' | 'getFirstLinkpathDest' | 'getFileCache'>;

const SUBPATH_SEPARATOR = '#';

/**
 * Decides whether a note embed gets the "inline note" icon: a whole-note
 * embed of a plain `.md` note that is that note's ONLY link in the vault.
 *
 * A cheap pre-check only — the click runs the full InlineNoteAction, whose
 * refusals stay the single source of truth. Hence `resolvedLinks` only
 * (cheap, read on every render), never a canvas scan: a note whose extra
 * link sits in a canvas still shows the icon, and the click refuses with
 * the normal "2+ links" message — accepted ceiling (rare; upgrade path: a
 * canvas-link index).
 */
export class EmbedInlineIconRule {
  constructor(private readonly linkIndex: EmbedLinkIndex) {
  }

  /** The note the icon would inline, or null when the embed gets no icon. */
  inlineTargetOf(embed: EmbedFacts): TFile | null {
    if (embed.isNested || embed.isInCanvas) {
      return null;
    }
    const separatorIndex = embed.src.indexOf(SUBPATH_SEPARATOR);
    if (separatorIndex >= 0) {
      return null; // partial embed (`#Heading`, `#^block`)
    }
    const target = this.linkIndex.getFirstLinkpathDest(embed.src, embed.sourcePath);
    if (target === null || !this.isPlainNote(target) || this.incomingLinkCount(target) !== 1) {
      return null;
    }
    return target;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private isPlainNote(file: TFile): boolean {
    const frontmatter: unknown = this.linkIndex.getFileCache(file)?.frontmatter;
    const markedExcalidraw = typeof frontmatter === 'object' && frontmatter !== null
      && PlainNoteCheck.EXCALIDRAW_FRONTMATTER_KEY in frontmatter;
    return PlainNoteCheck.hasPlainMarkdownName(file) && !markedExcalidraw;
  }

  /**
   * Links to `target` across the vault, self-links ignored (as InlineEligibility does).
   * O(vault files) per call — a lookup per source; fine per render. Upgrade
   * path if it ever shows in profiles: a reverse index rebuilt on `resolved`.
   */
  private incomingLinkCount(target: TFile): number {
    let count = 0;
    for (const [sourcePath, links] of Object.entries(this.linkIndex.resolvedLinks)) {
      if (sourcePath !== target.path) {
        count += links[target.path] ?? 0;
      }
    }
    return count;
  }
}
