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
 * Matches an open Settings modal, queried on a window's `<body>`.
 *
 * UNDOCUMENTED Obsidian DOM contract (verified on 1.12.7): Settings renders as
 * `<body> > .modal-container > .modal.mod-settings`; Obsidian exposes no public
 * Settings open/close event. CEILING: if Obsidian renames these classes,
 * detection silently degrades to the old behavior (Settings does not end a
 * session) — e2e/switchToSettings.e2e.ts guards this on Obsidian bumps.
 */
export const SETTINGS_MODAL_SELECTOR = ':scope > .modal-container > .modal.mod-settings';

/** Per registered window: its Settings-modal observer + last-seen Settings state. */
interface WindowState {
  readonly observer: MutationObserver;
  settingsOpen: boolean;
}

/**
 * DOM boundary for V3 duration tracking: translates window focus/blur,
 * visibility changes, Settings modal open/close, and user-input events into
 * FocusDurationTracker calls.
 *
 * A window counts as focused for the tracker only when it is OS-focused AND
 * no Settings modal is open in it (owner decision: opening Settings ends the
 * session exactly like a window blur — no grace; closing it starts a new one).
 * WHY-NOT all modals: only Settings is a "leaving the note" context; the
 * command palette / quick switcher are part of working ON the note.
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
 * popout listeners additionally die with their window. Settings observers
 * are disconnected on window-close and on unload (plugin.register).
 */
export class WindowActivityMonitor {
  // WHY-NOT activeDocument: this class deliberately registers on SPECIFIC
  // windows' documents (main injected, popouts via 'window-open' or leaf
  // discovery), never on "whichever window is active right now".
  /** Registered windows; also guards against double-registration (leaf discovery vs. constructor). */
  private readonly windows = new Map<Document, WindowState>();

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
        this.windows.get(workspaceWindow.doc)?.observer.disconnect();
        this.windows.delete(workspaceWindow.doc);
      }),
    );
    this.plugin.register(() => {
      for (const state of this.windows.values()) {
        state.observer.disconnect();
      }
      this.windows.clear();
    });
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
    if (this.windows.has(doc)) {
      return;
    }
    const state: WindowState = {
      observer: this.observeSettingsModal(win, doc),
      // Seed: Settings may already be open (plugin enabled from Settings).
      settingsOpen: WindowActivityMonitor.isSettingsOpen(doc),
    };
    this.windows.set(doc, state);
    const tracker = this.tracker;
    this.plugin.registerDomEvent(win, 'blur', () => tracker.onWindowBlurred(doc));
    this.plugin.registerDomEvent(win, 'focus', () => {
      // Alt-tab back while Settings is still open: not focused on the doc yet.
      if (!state.settingsOpen) {
        tracker.onWindowFocused(doc);
      }
    });
    // visibilitychange complements blur/focus (e.g. minimize / OS app switch
    // on some platforms, mobile backgrounding). Visible does NOT imply
    // focused — hence the hasFocus() check.
    this.plugin.registerDomEvent(doc, 'visibilitychange', () => {
      if (doc.hidden) {
        tracker.onWindowBlurred(doc);
      } else {
        this.focusIfEffectivelyFocused(doc, state);
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
    this.focusIfEffectivelyFocused(doc, state);
  }

  /**
   * Watches the window body's DIRECT children only (childList, no subtree —
   * cheap: fires only when a top-level overlay like a modal/menu is added or
   * removed) and treats a Settings open/close like a window blur/refocus.
   */
  private observeSettingsModal(win: Window, doc: Document): MutationObserver {
    // System boundary: Obsidian types popout windows as plain `Window`, but
    // each is a full browser global. The window's OWN constructor keeps the
    // observer in the same realm as the body it watches.
    const ObserverCtor = (win as Window & { MutationObserver: typeof MutationObserver }).MutationObserver;
    const observer = new ObserverCtor(() => {
      const state = this.windows.get(doc);
      if (state !== undefined) {
        this.onSettingsMaybeToggled(doc, state);
      }
    });
    observer.observe(doc.body, { childList: true });
    return observer;
  }

  private onSettingsMaybeToggled(doc: Document, state: WindowState): void {
    const open = WindowActivityMonitor.isSettingsOpen(doc);
    if (open === state.settingsOpen) {
      return; // unrelated body mutation (menu, notice, other modal)
    }
    state.settingsOpen = open;
    if (open) {
      this.tracker.onWindowBlurred(doc);
    } else {
      this.focusIfEffectivelyFocused(doc, state);
    }
  }

  /** Effectively focused = OS-focused AND no Settings modal open in that window. */
  private focusIfEffectivelyFocused(doc: Document, state: WindowState): void {
    if (doc.hasFocus() && !state.settingsOpen) {
      this.tracker.onWindowFocused(doc);
    }
  }

  private static isSettingsOpen(doc: Document): boolean {
    return doc.body.querySelector(SETTINGS_MODAL_SELECTOR) !== null;
  }
}
