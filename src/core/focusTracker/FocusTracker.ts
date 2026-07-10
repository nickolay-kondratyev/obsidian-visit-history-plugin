import { Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';
import { IsTrackedProvider } from "../util/vault/IsTrackedProvider";


// ── Types ─────────────────────────────────────────────────────────────────────

export interface FocusEvent {
  type: string;   // 'markdown' | 'canvas' | 'excalidraw'
  title: string;
  file: TFile;
}

export interface FocusListener {
  onFocus(event: FocusEvent): Promise<void>;

  onUnfocus(event: FocusEvent): Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function viewToFocusEvent(view: View): FocusEvent {
  return {
    type: view.getViewType(),
    title: view.getDisplayText(),
    // System boundary: Obsidian's View type does not declare `file`, but
    // tracked view types (markdown/canvas/excalidraw) carry it at runtime.
    // IsTrackedProvider.isTrackedView() has already verified it is present.
    file: (view as View & { file: TFile }).file,
  };
}

// ── FocusTracker ──────────────────────────────────────────────────────────────

export class FocusTracker {
  private previousLeaf: WorkspaceLeaf | null = null;
  private listeners: FocusListener[] = [];

  // Serializes event handling: listener handlers await file IO, so without
  // chaining, a second rapid leaf-change could interleave at those awaits and
  // deliver focus/unfocus to listeners OUT OF ORDER (breaking stateful
  // listeners such as duration tracking). The chain never stays rejected —
  // handleLeafChange isolates listener errors and the .catch below is a
  // safety net for unexpected throws.
  private dispatchChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly plugin: Plugin,
    private readonly isTrackedProvider: IsTrackedProvider
  ) {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
        this.dispatchChain = this.dispatchChain
          .then(() => this.handleLeafChange(leaf ?? null))
          .catch((error) => {
            console.error('[VHP][FocusTracker] leaf-change handling failed', error);
          });
      })
    );
  }

  registerListener(listener: FocusListener): void {
    this.listeners.push(listener);
  }

  /** Resolves once every leaf-change event received so far has been dispatched. */
  whenIdle(): Promise<void> {
    return this.dispatchChain;
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async handleLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
    if (this.previousLeaf && this.previousLeaf !== leaf) {
      const prev = this.previousLeaf.view;
      if (this.isTrackedProvider.isTrackedView(prev)) {
        await this.dispatch(viewToFocusEvent(prev), 'onUnfocus');
      }
    }

    if (leaf && this.isTrackedProvider.isTrackedView(leaf.view)) {
      await this.dispatch(viewToFocusEvent(leaf.view), 'onFocus');
    }

    this.previousLeaf = leaf;
  }

  /**
   * Dispatches to all listeners, isolating failures: one throwing listener
   * must not block the others nor surface as an unhandled promise rejection
   * (handleLeafChange is fired-and-forgotten from the workspace event).
   */
  private async dispatch(event: FocusEvent, method: 'onFocus' | 'onUnfocus'): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener[method](event);
      } catch (error) {
        console.error(`[VHP][FocusTracker] listener ${method} failed for path=[${event.file?.path}]`, error);
      }
    }
  }
}
