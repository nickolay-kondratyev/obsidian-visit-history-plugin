import { Plugin } from 'obsidian';
import { FocusDurationTracker } from './FocusDurationTracker';

// Window-level "user is interacting" signals for idle detection. Window-wide
// on purpose (80/20): scoping to the active leaf's DOM subtree would add real
// complexity for little accuracy gain — any interaction with Obsidian keeps
// the focused doc's session alive.
const ACTIVITY_EVENT_TYPES: ReadonlyArray<keyof DocumentEventMap> = [
  'keydown',
  'mousedown',
  'mousemove',
  'wheel',
  'touchstart',
  'touchmove',
];

/**
 * DOM boundary for V3 duration tracking: translates window focus/blur,
 * visibility changes, and user-input events into FocusDurationTracker calls.
 *
 * Registers on EVERY Obsidian window: the main window at construction, future
 * popouts via the 'window-open' workspace event, and popouts that ALREADY
 * exist at construction (plugin enabled/reloaded/updated while popouts are
 * open — their 'window-open' fired before this plugin loaded) discovered
 * through their leaves' owner documents. A window's Document object is its
 * identity (WindowHandle) — the same object a leaf reports through
 * FocusEvent.ownerDocument, so per-window focus matches up.
 *
 * All handlers go through plugin.registerDomEvent → auto-cleanup on unload;
 * popout listeners additionally die with their window. Trivial glue by
 * design — the logic lives in the tracker.
 */
export class WindowActivityMonitor {
  /* eslint-disable obsidianmd/prefer-active-doc --
     WHY-NOT activeDocument: this class deliberately registers on a SPECIFIC
     window's document (main at load, each popout on 'window-open' or leaf
     discovery), never on "whichever window is active right now". */
  /** Guards against double-registration (leaf discovery vs. constructor). */
  private readonly registeredDocs = new Set<Document>();

  constructor(
    private readonly plugin: Plugin,
    private readonly tracker: FocusDurationTracker,
    // Injected (PluginFactory passes the globals) — unit-testable without a DOM.
    mainWindow: Window,
    mainDocument: Document,
  ) {
    this.registerWindow(mainWindow, mainDocument);
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('window-open', (workspaceWindow) => {
        this.registerWindow(workspaceWindow.win, workspaceWindow.doc);
      }),
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('window-close', (workspaceWindow) => {
        // A closing window can no longer emit blur — unfocus it explicitly so
        // a doc it hosted records its duration.
        this.tracker.onWindowBlurred(workspaceWindow.doc);
        // Drop the dead Document reference (and allow re-registration if the
        // same Document object ever hosted a window again).
        this.registeredDocs.delete(workspaceWindow.doc);
      }),
    );
    this.registerPreExistingPopouts(mainDocument);
  }

  // ── private ─────────────────────────────────────────────────────────────

  /** See the class doc: popouts open BEFORE plugin load never fire 'window-open'. */
  private registerPreExistingPopouts(mainDocument: Document): void {
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const doc = leaf.view.containerEl.ownerDocument;
      const win = doc.defaultView;
      if (doc !== mainDocument && win !== null) {
        this.registerWindow(win, doc);
      }
    });
  }

  private registerWindow(win: Window, doc: Document): void {
    if (this.registeredDocs.has(doc)) {
      return;
    }
    this.registeredDocs.add(doc);
    const tracker = this.tracker;
    this.plugin.registerDomEvent(win, 'blur', () => tracker.onWindowBlurred(doc));
    this.plugin.registerDomEvent(win, 'focus', () => tracker.onWindowFocused(doc));
    // visibilitychange complements blur/focus (e.g. minimize / OS app switch
    // on some platforms, mobile backgrounding). Visible does NOT imply
    // focused — hence the hasFocus() check.
    this.plugin.registerDomEvent(doc, 'visibilitychange', () => {
      if (doc.hidden) {
        tracker.onWindowBlurred(doc);
      } else if (doc.hasFocus()) {
        tracker.onWindowFocused(doc);
      }
    });
    for (const eventType of ACTIVITY_EVENT_TYPES) {
      // capture: leaf content often stops propagation; passive: never block
      // scrolling — the handler only stamps lastActivity.
      this.plugin.registerDomEvent(
        doc,
        eventType,
        () => tracker.onUserActivity(),
        { capture: true, passive: true },
      );
    }
    // Seed: focus events won't fire for a window that is ALREADY focused at
    // registration time (main window at plugin load; a fresh popout).
    if (doc.hasFocus()) {
      tracker.onWindowFocused(doc);
    }
  }
  /* eslint-enable obsidianmd/prefer-active-doc */
}
