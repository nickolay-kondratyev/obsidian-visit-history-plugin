import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import { EmbedInlineIconDecorator } from './EmbedInlineIconDecorator';

/**
 * Reading-view entry of the embed "inline note" icon: a markdown
 * post-processor. Note embeds load ASYNCHRONOUSLY (the native link icon
 * arrives after post-processing), so each section holding an embed gets a
 * MutationObserver that re-syncs it for as long as the section is rendered.
 *
 * Also runs on embed BODIES rendered inside live preview; the embeds found
 * there are nested, so they never get an icon (EmbedInlineIconRule).
 */
export class ReadingViewEmbedIconProcessor {
  /**
   * Live sections, strong refs on purpose: plugin unload must reach them —
   * Obsidian keeps embed bodies inside live-preview widgets (and their
   * render children) alive across a plugin disable.
   */
  private readonly liveSections = new Set<EmbedIconSection>();
  /** At most one observer per section element, even if post-processed twice. */
  private readonly observedEls = new WeakSet<HTMLElement>();

  constructor(private readonly decorator: EmbedInlineIconDecorator) {
  }

  readonly process = (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    if (this.observedEls.has(el) || !EmbedInlineIconDecorator.containsEmbed(el)) {
      return;
    }
    const section = new EmbedIconSection(el, ctx.sourcePath, this.decorator, (stopped) => {
      this.liveSections.delete(stopped);
      this.observedEls.delete(stopped.containerEl);
    });
    this.liveSections.add(section);
    this.observedEls.add(el);
    // Loaded HERE, not left to addChild: a never-loaded component ignores
    // unload(), and teardown() must be able to undo it.
    section.load();
    // The renderer unloads the section once its element is re-rendered away.
    ctx.addChild(section);
  };

  /** Plugin unload: stops every observer and removes every icon this processor added. */
  teardown(): void {
    // Copied: each unload calls back into the set.
    for (const section of Array.from(this.liveSections)) {
      section.unload();
    }
  }
}

/** One rendered section holding embeds: keeps its icons in sync while it lives. */
class EmbedIconSection extends MarkdownRenderChild {
  // childList only: embed loading adds children; our own icon writes trigger
  // one extra, no-op sync (the decorator is idempotent), not a loop.
  private readonly observer = new MutationObserver(() => this.sync());

  constructor(
    containerEl: HTMLElement,
    private readonly sourcePath: string,
    private readonly decorator: EmbedInlineIconDecorator,
    private readonly onStopped: (section: EmbedIconSection) => void,
  ) {
    super(containerEl);
  }

  onload(): void {
    this.sync();
    this.observer.observe(this.containerEl, { childList: true, subtree: true });
  }

  onunload(): void {
    this.observer.disconnect();
    this.decorator.removeAll(this.containerEl);
    this.onStopped(this);
  }

  private sync(): void {
    try {
      this.decorator.sync(this.containerEl, this.sourcePath);
    } catch (error) {
      console.error('[VHP][ReadingViewEmbedIconProcessor] embed icon sync failed', error);
    }
  }
}
