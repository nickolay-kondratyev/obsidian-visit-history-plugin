import { setIcon, setTooltip, TFile } from 'obsidian';
import { EmbedFacts, EmbedInlineIconRule } from './EmbedInlineIconRule';

/** Starts the inline-note action for the embedded note (same action as its file menu entry). */
export type InlineNoteStarter = (note2: TFile) => void;

const ICON_CLASS = 'vhp-embed-inline-link';
const ICON_NAME = 'merge';
const ICON_TOOLTIP = 'Inline note into this note';
/** Remembers which note an icon inlines, so a re-sync can tell whether it is still right. */
const TARGET_PATH_ATTR = 'data-vhp-inline-target';
const PRIMARY_BUTTON = 0;

/** Obsidian's wrapper of any `![[ ]]` — in reading view AND live preview. */
const SEL_INTERNAL_EMBED = '.internal-embed';
/**
 * Obsidian's own "open link" icon of a note embed (top-right corner) —
 * verified on Obsidian 1.12.7 in both modes. Added only once a NOTE embed
 * has loaded (async); media embeds never get one — so it doubles as the
 * readiness gate, and ours is placed right beside it (styles.css).
 */
const SEL_NATIVE_LINK = ':scope > .markdown-embed-link';
const SEL_OWN_ICON = `:scope > .${ICON_CLASS}`;
const SEL_CANVAS_NODE = '.canvas-node';

/**
 * The single DOM write path of the embed "inline note" icon, shared by the
 * reading-view post-processor and the live-preview editor extension.
 *
 * WHY no public API: Obsidian has none for decorating note embeds, so this
 * works on Obsidian's embed DOM. Idempotent — the DOM is touched only when
 * an embed's icon is missing, stale, or no longer wanted, because both
 * callers re-run it from MutationObservers that also see our own writes.
 */
export class EmbedInlineIconDecorator {
  constructor(
    private readonly rule: EmbedInlineIconRule,
    private readonly startInlineNote: InlineNoteStarter,
  ) {
  }

  static containsEmbed(root: HTMLElement): boolean {
    return root.querySelector(SEL_INTERNAL_EMBED) !== null;
  }

  /** Brings every embed under `root` in line with the rule. `sourcePath` = note being rendered. */
  sync(root: HTMLElement, sourcePath: string): void {
    for (const embed of Array.from(root.querySelectorAll<HTMLElement>(SEL_INTERNAL_EMBED))) {
      this.syncEmbed(embed, sourcePath);
    }
  }

  /** Removes every icon under `root` (plugin unload / render teardown). */
  removeAll(root: HTMLElement): void {
    for (const icon of Array.from(root.querySelectorAll(`.${ICON_CLASS}`))) {
      icon.remove();
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private syncEmbed(embed: HTMLElement, sourcePath: string): void {
    // Detached (mid-render): nesting can't be told yet — the next mutation re-syncs.
    if (!embed.isConnected) {
      return;
    }
    const nativeLink = embed.querySelector(SEL_NATIVE_LINK);
    const existing = embed.querySelector(SEL_OWN_ICON);
    const target = nativeLink === null ? null : this.rule.inlineTargetOf(EmbedInlineIconDecorator.factsOf(embed, sourcePath));
    if (target === null) {
      existing?.remove();
      return;
    }
    if (existing?.getAttribute(TARGET_PATH_ATTR) === target.path) {
      return;
    }
    existing?.remove();
    this.createIcon(embed, target);
  }

  private createIcon(embed: HTMLElement, target: TFile): void {
    const icon = embed.createDiv({ cls: ICON_CLASS, attr: { role: 'button', [TARGET_PATH_ATTR]: target.path } });
    setIcon(icon, ICON_NAME);
    setTooltip(icon, ICON_TOOLTIP);
    icon.addEventListener('click', (event) => {
      if (event.button !== PRIMARY_BUTTON) {
        return;
      }
      // Same as the native icon: the click must not also open the embed or,
      // in live preview, move the cursor into it.
      event.preventDefault();
      event.stopPropagation();
      this.startInlineNote(target);
    });
  }

  private static factsOf(embed: HTMLElement, sourcePath: string): EmbedFacts {
    return {
      src: embed.getAttribute('src') ?? '',
      sourcePath,
      isNested: embed.parentElement?.closest(SEL_INTERNAL_EMBED) != null,
      isInCanvas: embed.closest(SEL_CANVAS_NODE) !== null,
    };
  }
}
