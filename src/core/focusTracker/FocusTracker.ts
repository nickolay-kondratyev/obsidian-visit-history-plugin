import { Plugin, TFile, View } from 'obsidian';
import { IsTrackedProvider } from "../util/vault/IsTrackedProvider";


// ── Types ─────────────────────────────────────────────────────────────────────

export interface FocusEvent {
  type: string;   // 'markdown' | 'canvas' | 'excalidraw'
  title: string;
  file: TFile;
  /**
   * Document of the OS window hosting the view (main window or popout).
   * Identity token for per-window focus tracking (V3 durations) — stable for
   * the window's lifetime; compare by reference.
   */
  ownerDocument: Document;
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
    // The window hosting the view: main window's document for main-window
    // leaves, the popout's own document for popout leaves.
    ownerDocument: view.containerEl.ownerDocument,
  };
}

// ── FocusTracker ──────────────────────────────────────────────────────────────

export class FocusTracker {
  /**
   * The focus event last DISPATCHED — replayed as the unfocus payload.
   * Tracked by FILE (not leaf): same-leaf navigation replaces the leaf's view
   * in place, so leaf identity cannot tell "still the same doc" from "moved
   * to another doc or an untracked view (e.g. a PDF)".
   */
  private lastFocusEvent: FocusEvent | null = null;
  private readonly listeners: FocusListener[] = [];

  // Serializes event handling: listener handlers await file IO, so without
  // chaining, a second rapid leaf-change could interleave at those awaits and
  // deliver focus/unfocus to listeners OUT OF ORDER (breaking stateful
  // listeners such as duration tracking). The chain never stays rejected —
  // handleActiveViewChange isolates listener errors and the .catch below is a
  // safety net for unexpected throws.
  private dispatchChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly plugin: Plugin,
    private readonly isTrackedProvider: IsTrackedProvider
  ) {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
        // leaf.view is read INSIDE the chain (when handled), as before.
        this.enqueueActiveViewChange(() => leaf?.view ?? null);
      })
    );
  }

  /**
   * Dispatches the CURRENTLY active leaf's view as if `active-leaf-change`
   * had fired for it. Call ONCE when the layout is ready: when the plugin is
   * enabled while a doc is already open (fresh enable, update reload, hot
   * reload) no leaf-change ever fires for that doc, so without this sync its
   * visit is never recorded. Enqueued on the serialized dispatch chain (and
   * the view read when it RUNS), so ordering with live events holds and a
   * later replayLastFocusTo sees it. Repeating a file a startup leaf-change
   * already delivered is a harmless duplicate focus (no unfocus dispatched).
   */
  syncWithActiveLeaf(): void {
    // WHY getActiveViewOfType(View): it is exactly the active leaf's view —
    // the same leaf `active-leaf-change` delivers (incl. sidebar leaves).
    // WHY-NOT workspace.activeLeaf: deprecated. WHY-NOT getMostRecentLeaf():
    // skips sidebars, so with e.g. the search pane active it would report the
    // editor doc as focused — diverging from the live-event semantics.
    this.enqueueActiveViewChange(() => this.plugin.app.workspace.getActiveViewOfType(View));
  }

  registerListener(listener: FocusListener): void {
    this.listeners.push(listener);
  }

  /**
   * Re-delivers the last dispatched focus event to ONE late-registered
   * listener (the V3 duration listener joins only after the user-name pin —
   * without a replay the startup-restored / modal-time focused doc's session
   * would never open). Enqueued on the serialized dispatch chain, with the
   * event read INSIDE the chain: pending leaf-changes settle first, so the
   * listener never receives a stale focus and in-order delivery holds.
   * Already-registered listeners saw the event live and are not re-notified.
   */
  replayLastFocusTo(listener: FocusListener): void {
    this.dispatchChain = this.dispatchChain
      .then(async () => {
        const event = this.lastFocusEvent;
        if (event === null) return;
        try {
          await listener.onFocus(event);
        } catch (error) {
          console.error(`[VHP][FocusTracker] focus replay failed for path=[${event.file?.path}]`, error);
        }
      })
      .catch((error) => {
        console.error('[VHP][FocusTracker] focus replay failed', error);
      });
  }

  /** Resolves once every leaf-change event received so far has been dispatched. */
  whenIdle(): Promise<void> {
    return this.dispatchChain;
  }

  // ── private ───────────────────────────────────────────────────────────────

  /** The view is read when the queued change RUNS — never a stale snapshot. */
  private enqueueActiveViewChange(readView: () => View | null): void {
    this.dispatchChain = this.dispatchChain
      .then(() => this.handleActiveViewChange(readView()))
      .catch((error) => {
        console.error('[VHP][FocusTracker] leaf-change handling failed', error);
      });
  }

  private async handleActiveViewChange(view: View | null): Promise<void> {
    const nextEvent = view !== null && this.isTrackedProvider.isTrackedView(view)
      ? viewToFocusEvent(view)
      : null;

    // Unfocus whenever the focused FILE changes — including same-leaf
    // navigation to an untracked view, which would otherwise dispatch nothing
    // and leave a V3 duration session running. A duplicate event for the SAME
    // file dispatches no unfocus (a running session must not fragment), but
    // still re-dispatches focus so listeners see the fresh ownerDocument
    // (tab dragged to a popout keeps its session in the new window).
    if (this.lastFocusEvent !== null && this.lastFocusEvent.file.path !== nextEvent?.file.path) {
      await this.dispatch(this.lastFocusEvent, 'onUnfocus');
    }

    this.lastFocusEvent = nextEvent;
    if (nextEvent !== null) {
      await this.dispatch(nextEvent, 'onFocus');
    }
  }

  /**
   * Dispatches to all listeners, isolating failures: one throwing listener
   * must not block the others nor surface as an unhandled promise rejection
   * (handleActiveViewChange is fired-and-forgotten from the workspace event).
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
