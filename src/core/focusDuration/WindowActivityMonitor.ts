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
 * All handlers are registered via plugin.registerDomEvent → auto-cleanup on
 * unload. Trivial glue by design — the logic lives in the tracker.
 */
export class WindowActivityMonitor {
  /* eslint-disable obsidianmd/prefer-active-doc --
     WHY-NOT activeDocument: registration happens ONCE at plugin load, when
     activeDocument === document (the main window), so it would not change
     behavior. Tracking activity inside popout windows needs per-window
     registration via the 'window-open' workspace event — follow-up work. */
  constructor(plugin: Plugin, tracker: FocusDurationTracker) {
    plugin.registerDomEvent(window, 'blur', () => tracker.onWindowBlurred());
    plugin.registerDomEvent(window, 'focus', () => tracker.onWindowFocused());
    // visibilitychange complements blur/focus (e.g. minimize / OS app switch
    // on some platforms); the tracker ignores duplicate transitions.
    plugin.registerDomEvent(document, 'visibilitychange', () => {
      if (document.hidden) {
        tracker.onWindowBlurred();
      } else {
        tracker.onWindowFocused();
      }
    });
    for (const eventType of ACTIVITY_EVENT_TYPES) {
      // capture: leaf content often stops propagation; passive: never block
      // scrolling — the handler only stamps lastActivity.
      plugin.registerDomEvent(
        document,
        eventType,
        () => tracker.onUserActivity(),
        { capture: true, passive: true },
      );
    }
  }
  /* eslint-enable obsidianmd/prefer-active-doc */
}
