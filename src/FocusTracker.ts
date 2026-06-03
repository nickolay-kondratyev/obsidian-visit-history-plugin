import { Plugin, WorkspaceLeaf, View } from 'obsidian';

const TRACKED_VIEW_TYPES = new Set(['markdown', 'canvas', 'excalidraw']);

function isTracked(view: View | null): boolean {
  return TRACKED_VIEW_TYPES.has(view?.getViewType() ?? '');
}

// ── FocusTracker ──────────────────────────────────────────────────────────────
export class FocusTracker {
  private previousLeaf: WorkspaceLeaf | null = null;

  constructor(private readonly plugin: Plugin) {
  }

  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
        this.handleLeafChange(leaf ?? null);
      })
    );
  }

  // ── private ───────────────────────────────────────────────────────────────

  private handleLeafChange(leaf: WorkspaceLeaf | null): void {
    if (this.previousLeaf && this.previousLeaf !== leaf) {
      const prev = this.previousLeaf.view;
      if (isTracked(prev)) {
        this.onUnfocus(prev);
      }
    }

    if (leaf && isTracked(leaf.view)) {
      this.onFocus(leaf.view);
    }

    this.previousLeaf = leaf;
  }

  private onFocus(view: View): void {
    const type = view.getViewType();
    const title = view.getDisplayText();
    const file = (view as any).file?.path ?? null;

    console.log('[FocusTracker] focus', {type, title, file});
  }

  private onUnfocus(view: View): void {
    const type = view.getViewType();
    const title = view.getDisplayText();
    const file = (view as any).file?.path ?? null;

    console.log('[FocusTracker] unfocus', {type, title, file});
  }
}