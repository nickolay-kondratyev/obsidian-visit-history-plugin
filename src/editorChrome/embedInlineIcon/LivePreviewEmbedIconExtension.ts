import type { Extension } from '@codemirror/state';
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import { EmbedInlineIconDecorator } from './EmbedInlineIconDecorator';

/**
 * Live-preview entry of the embed "inline note" icon: a CM6 ViewPlugin.
 *
 * Embed widgets are Obsidian's DOM, rendered ASYNCHRONOUSLY outside CM's
 * update cycle, so a childList MutationObserver on `contentDOM` is what
 * actually drives syncing. Everything injected is removed in destroy():
 * Obsidian's widget DOM outlives this view (plugin disable, reconfigure).
 *
 * Never lets a throw escape: CM6 deactivates a ViewPlugin for the rest of
 * the session after an uncaught throw.
 */
class LivePreviewEmbedIconView implements PluginValue {
  private readonly observer: MutationObserver;

  constructor(
    private readonly view: EditorView,
    private readonly decorator: EmbedInlineIconDecorator,
  ) {
    // childList only: our own icon writes trigger one extra, no-op sync.
    this.observer = new MutationObserver(() => this.sync());
    this.observer.observe(view.contentDOM, { childList: true, subtree: true });
    this.sync();
  }

  update(update: ViewUpdate): void {
    // focusChanged: coming back to this note re-checks link counts that
    // changed elsewhere meanwhile (the embed DOM itself did not mutate).
    if (update.docChanged || update.viewportChanged || update.focusChanged) {
      this.sync();
    }
  }

  destroy(): void {
    this.observer.disconnect();
    this.safely(() => this.decorator.removeAll(this.view.contentDOM));
  }

  private sync(): void {
    this.safely(() => {
      const sourcePath = this.view.state.field(editorInfoField, false)?.file?.path;
      if (sourcePath !== undefined) {
        this.decorator.sync(this.view.contentDOM, sourcePath);
      }
    });
  }

  private safely(work: () => void): void {
    try {
      work();
    } catch (error) {
      console.error('[VHP][LivePreviewEmbedIconExtension] embed icon sync failed', error);
    }
  }
}

export class LivePreviewEmbedIconExtension {
  static create(decorator: EmbedInlineIconDecorator): Extension {
    return ViewPlugin.define((view) => new LivePreviewEmbedIconView(view, decorator));
  }
}
