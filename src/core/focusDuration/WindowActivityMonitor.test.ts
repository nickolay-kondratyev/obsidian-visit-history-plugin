import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { SETTINGS_MODAL_SELECTOR, WindowActivityMonitor } from './WindowActivityMonitor';
import { FocusDurationSink, FocusDurationTracker, UNFOCUS_GRACE_MS, WindowTimers } from './FocusDurationTracker';

const IDLE_MS = 180_000;
const DWELL_MS = 5000;
/** Margin for input fired just before the idle deadline, then checked just after it. */
const BEFORE_IDLE_MS = 1000;
const DOC_ID = 'X';

// Built at CALL time (inside a test, after vi.useFakeTimers) so the shorthand
// captures the FAKE clock; advanceTimersByTime then drives the tracker.
function fakeTimers(): WindowTimers {
  return { setTimeout, clearTimeout };
}

/** Fake MutationObserver: records its config; `trigger` simulates a body childList mutation. */
class FakeMutationObserver {
  static readonly instances: FakeMutationObserver[] = [];
  observedTarget: unknown = undefined;
  observedOptions: MutationObserverInit | undefined = undefined;
  disconnected = false;

  constructor(private readonly callback: () => void) {
    FakeMutationObserver.instances.push(this);
  }

  observe(target: unknown, options: MutationObserverInit): void {
    this.observedTarget = target;
    this.observedOptions = options;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    if (!this.disconnected) {
      this.callback();
    }
  }
}

/**
 * Fake OS window: just the members the monitor touches (node has no DOM).
 * Mutable state models the OS/Obsidian: `focused` (hasFocus), `hidden`
 * (visibility), `settingsOpen` (Settings modal present under body).
 */
class FakeWindow {
  focused: boolean;
  hidden = false;
  settingsOpen = false;
  readonly body: { querySelector: (selector: string) => unknown };
  readonly win: Window;
  readonly doc: Document;

  constructor(name: string, focused: boolean) {
    this.focused = focused;
    this.body = {
      querySelector: (selector: string) =>
        selector === SETTINGS_MODAL_SELECTOR && this.settingsOpen ? {} : null,
    };
    this.win = { name, MutationObserver: FakeMutationObserver } as unknown as Window;
    const doc = {
      name,
      hasFocus: () => this.focused,
      defaultView: this.win,
      body: this.body,
    };
    // Getter so the monitor always reads the CURRENT fake visibility.
    Object.defineProperty(doc, 'hidden', { get: () => this.hidden });
    this.doc = doc as unknown as Document;
  }
}

interface DomRegistration {
  target: unknown;
  type: string;
  handler: () => void;
}

type WorkspaceWindowHandler = (workspaceWindow: { win: Window; doc: Document }) => void;

/** Stub plugin capturing DOM handlers, workspace event handlers and unload callbacks. */
class StubPlugin {
  readonly domRegistrations: DomRegistration[] = [];
  readonly workspaceHandlers = new Map<string, WorkspaceWindowHandler>();
  readonly unloadCallbacks: Array<() => void> = [];
  readonly plugin: Plugin;

  /** `leafOwnerDocuments`: the workspace already CONTAINS these leaves (plugin reload while popouts are open). */
  constructor(leafOwnerDocuments: Document[] = []) {
    const stub = {
      registerDomEvent: (target: unknown, type: string, handler: () => void) => {
        this.domRegistrations.push({ target, type, handler });
      },
      registerEvent: () => undefined,
      register: (callback: () => void) => {
        this.unloadCallbacks.push(callback);
      },
      app: {
        workspace: {
          on: (name: string, handler: WorkspaceWindowHandler) => {
            this.workspaceHandlers.set(name, handler);
            return {};
          },
          iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void) => {
            for (const ownerDocument of leafOwnerDocuments) {
              const leaf = { view: { containerEl: { ownerDocument } } };
              callback(leaf as unknown as WorkspaceLeaf);
            }
          },
        },
      },
    };
    // System boundary: the monitor only touches the members stubbed above.
    this.plugin = stub as unknown as Plugin;
  }

  /** Fires the DOM event handler(s) registered for `type` on `target`. */
  fire(target: unknown, type: string): void {
    for (const r of this.domRegistrations) {
      if (r.target === target && r.type === type) {
        r.handler();
      }
    }
  }

  unload(): void {
    for (const callback of this.unloadCallbacks) {
      callback();
    }
  }
}

class RecordingSink implements FocusDurationSink {
  readonly records: string[] = [];

  recordFocusDuration(docId: string, _focusStartEpochMs: number, durationMs: number): void {
    this.records.push(`${docId}:${durationMs}`);
  }
}

/** Main-window rig: monitor + tracker + sink over one fake (focused) main window. */
class MainWindowRig {
  readonly main: FakeWindow;
  readonly stub = new StubPlugin();
  readonly sink = new RecordingSink();
  readonly tracker: FocusDurationTracker;

  constructor(opts: { focused?: boolean; settingsOpen?: boolean } = {}) {
    this.main = new FakeWindow('main', opts.focused ?? true);
    this.main.settingsOpen = opts.settingsOpen ?? false;
    this.tracker = new FocusDurationTracker(this.sink, () => IDLE_MS, fakeTimers());
    new WindowActivityMonitor(this.stub.plugin, this.tracker, this.main.win, this.main.doc);
  }

  /** Main window's body observer (the one created at construction). */
  get mainObserver(): FakeMutationObserver {
    const observer = FakeMutationObserver.instances.find(o => o.observedTarget === this.main.body);
    if (observer === undefined) throw new Error('no observer on main body');
    return observer;
  }

  setSettingsOpen(open: boolean): void {
    this.main.settingsOpen = open;
    this.mainObserver.trigger();
  }

  fire(type: 'blur' | 'focus'): void {
    this.stub.fire(this.main.win, type);
  }

  /** Simulates Obsidian opening a popout AFTER construction ('window-open'). */
  openPopout(popout: FakeWindow): void {
    this.workspaceWindowEvent('window-open', popout);
  }

  /** Simulates Obsidian closing a popout ('window-close'). */
  closePopout(popout: FakeWindow): void {
    this.workspaceWindowEvent('window-close', popout);
  }

  private workspaceWindowEvent(name: 'window-open' | 'window-close', popout: FakeWindow): void {
    const handler = this.stub.workspaceHandlers.get(name);
    if (handler === undefined) throw new Error(`no ${name} handler registered`);
    handler({ win: popout.win, doc: popout.doc });
  }

  fireVisibility(hidden: boolean): void {
    this.main.hidden = hidden;
    this.stub.fire(this.main.doc, 'visibilitychange');
  }
}

describe('WindowActivityMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.parse('2026-07-09T22:00:00.000Z') });
    FakeMutationObserver.instances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('popouts already open at construction (plugin reload/update)', () => {
    it('should track durations for a doc focused in a PRE-EXISTING popout', () => {
      // GIVEN Obsidian with an OS-focused popout that existed before the
      // plugin loaded ('window-open' never fires for it)
      const main = new FakeWindow('main', false);
      const popout = new FakeWindow('popout', true);
      const { plugin } = new StubPlugin([popout.doc]);
      const sink = new RecordingSink();
      const tracker = new FocusDurationTracker(sink, () => IDLE_MS, fakeTimers());
      new WindowActivityMonitor(plugin, tracker, main.win, main.doc);
      // WHEN a doc hosted in that popout is focused for 5s, unfocused, and
      // the unfocus grace resolves
      tracker.onDocFocused(DOC_ID, popout.doc);
      vi.advanceTimersByTime(DWELL_MS);
      tracker.onDocUnfocused();
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      // THEN its session was recorded — the popout counts as a focused window
      expect(sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should register DOM listeners on the pre-existing popout window', () => {
      // GIVEN a pre-existing popout
      const main = new FakeWindow('main', true);
      const popout = new FakeWindow('popout', false);
      const stub = new StubPlugin([popout.doc]);
      // WHEN the monitor is constructed
      new WindowActivityMonitor(stub.plugin, new FocusDurationTracker(new RecordingSink(), () => IDLE_MS, fakeTimers()), main.win, main.doc);
      // THEN the popout window got its blur listener (focus/activity come with it)
      expect(stub.domRegistrations.filter(r => r.target === popout.win && r.type === 'blur')).toHaveLength(1);
    });

    it('should register each window exactly ONCE despite multiple leaves in it', () => {
      // GIVEN two leaves in one popout plus a main-window leaf
      const main = new FakeWindow('main', true);
      const popout = new FakeWindow('popout', false);
      const stub = new StubPlugin([popout.doc, popout.doc, main.doc]);
      // WHEN the monitor is constructed
      new WindowActivityMonitor(stub.plugin, new FocusDurationTracker(new RecordingSink(), () => IDLE_MS, fakeTimers()), main.win, main.doc);
      // THEN no window carries duplicate listeners (events would double-fire)
      expect(stub.domRegistrations.filter(r => r.type === 'blur').map(r => r.target)).toEqual([main.win, popout.win]);
    });
  });

  describe('window blur/focus/visibility wiring', () => {
    let rig: MainWindowRig;

    beforeEach(() => {
      // GIVEN a focused main window with doc X focused for DWELL_MS
      rig = new MainWindowRig();
      rig.tracker.onDocFocused(DOC_ID, rig.main.doc);
      vi.advanceTimersByTime(DWELL_MS);
    });

    it('should close the session immediately on window blur', () => {
      // WHEN the window blurs
      rig.main.focused = false;
      rig.fire('blur');
      // THEN the session is recorded at once (no grace)
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should start a NEW session on window focus after a blur', () => {
      // WHEN the window blurs, regains focus, and the doc dwells again before the next blur
      rig.main.focused = false;
      rig.fire('blur');
      rig.main.focused = true;
      rig.fire('focus');
      vi.advanceTimersByTime(DWELL_MS);
      rig.fire('blur');
      // THEN a second session was recorded
      expect(rig.sink.records).toHaveLength(2);
    });

    it('should close the session when the document becomes hidden', () => {
      // WHEN the window is hidden (minimized / backgrounded)
      rig.fireVisibility(true);
      // THEN the session is recorded
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should start a NEW session when the document becomes visible AND focused', () => {
      // WHEN hidden, then visible again with OS focus, then blurred after a dwell
      rig.fireVisibility(true);
      rig.fireVisibility(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.fire('blur');
      // THEN a second session was recorded
      expect(rig.sink.records).toHaveLength(2);
    });

    it('should NOT start a session when the document becomes visible WITHOUT focus', () => {
      // WHEN hidden, then visible again but another app holds OS focus
      rig.fireVisibility(true);
      rig.main.focused = false;
      rig.fireVisibility(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.fire('blur');
      // THEN only the first session exists
      expect(rig.sink.records).toHaveLength(1);
    });
  });

  describe('Settings modal', () => {
    let rig: MainWindowRig;

    beforeEach(() => {
      // GIVEN a focused main window with doc X focused for DWELL_MS
      rig = new MainWindowRig();
      rig.tracker.onDocFocused(DOC_ID, rig.main.doc);
      vi.advanceTimersByTime(DWELL_MS);
    });

    it('should observe ONLY the direct children of the window body (cheap: no subtree)', () => {
      // THEN the observer watches body childList only
      expect(rig.mainObserver.observedOptions).toEqual({ childList: true });
    });

    it('should close the session immediately when Settings opens', () => {
      // WHEN Settings opens
      rig.setSettingsOpen(true);
      // THEN the session is recorded at once (no grace)
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should NOT close again on an unrelated body mutation while Settings stays open', () => {
      // WHEN Settings opens and another body child mutation fires (e.g. a notice)
      rig.setSettingsOpen(true);
      rig.mainObserver.trigger();
      // THEN still exactly one record
      expect(rig.sink.records).toHaveLength(1);
    });

    it('should NOT revive an idle-closed session on an unrelated body mutation', () => {
      // WHEN the session idles out and a non-Settings body child mutation fires
      // (e.g. a notice) while the window stays OS-focused
      vi.advanceTimersByTime(IDLE_MS);
      rig.mainObserver.trigger();
      vi.advanceTimersByTime(DWELL_MS);
      rig.tracker.dispose();
      // THEN only the idle-closed session exists — no input, no new session
      expect(rig.sink.records).toHaveLength(1);
    });

    it('should start a NEW session for the still-focused doc when Settings closes', () => {
      // WHEN Settings opens, closes, and the doc dwells again before a blur
      rig.setSettingsOpen(true);
      rig.setSettingsOpen(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.fire('blur');
      // THEN the second session spans only the post-Settings dwell
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`, `${DOC_ID}:${DWELL_MS}`]);
    });

    it('should NOT start a session when Settings closes while the window is OS-blurred', () => {
      // WHEN Settings opens, the user alt-tabs away, then Settings closes (no OS focus)
      rig.setSettingsOpen(true);
      rig.main.focused = false;
      rig.fire('blur');
      rig.setSettingsOpen(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.tracker.dispose();
      // THEN no second session was opened (dispose would have flushed it)
      expect(rig.sink.records).toHaveLength(1);
    });

    it('should NOT start a session on window focus while Settings is still open', () => {
      // WHEN Settings opens, the user alt-tabs away and back, Settings still open
      rig.setSettingsOpen(true);
      rig.main.focused = false;
      rig.fire('blur');
      rig.main.focused = true;
      rig.fire('focus');
      vi.advanceTimersByTime(DWELL_MS);
      rig.tracker.dispose();
      // THEN no second session was opened
      expect(rig.sink.records).toHaveLength(1);
    });

    it('should NOT start a session when the document becomes visible while Settings is open', () => {
      // WHEN Settings opens, the window is hidden and shown again (focused), Settings still open
      rig.setSettingsOpen(true);
      rig.fireVisibility(true);
      rig.fireVisibility(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.tracker.dispose();
      // THEN no second session was opened
      expect(rig.sink.records).toHaveLength(1);
    });

    it('should stop observing on plugin unload', () => {
      // WHEN the plugin unloads
      rig.stub.unload();
      // THEN the body observer is disconnected
      expect(rig.mainObserver.disconnected).toBe(true);
    });
  });

  describe('Settings already open at construction (plugin enabled from Settings)', () => {
    let rig: MainWindowRig;

    beforeEach(() => {
      // GIVEN a focused main window whose Settings modal is ALREADY open
      rig = new MainWindowRig({ settingsOpen: true });
      rig.tracker.onDocFocused(DOC_ID, rig.main.doc);
      vi.advanceTimersByTime(DWELL_MS);
    });

    it('should NOT open a session while Settings is open', () => {
      // WHEN the plugin unloads (flushing any open session)
      rig.tracker.dispose();
      // THEN nothing was recorded
      expect(rig.sink.records).toEqual([]);
    });

    it('should open a session once Settings closes', () => {
      // WHEN Settings closes and the doc dwells before a blur
      rig.setSettingsOpen(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.fire('blur');
      // THEN exactly the post-Settings dwell is recorded
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });
  });

  describe('user input events', () => {
    // Mirrors the monitor's ACTIVITY_EVENT_TYPES (module-private).
    const INPUT_EVENT_TYPES = ['keydown', 'mousedown', 'mousemove', 'wheel', 'touchstart', 'touchmove'];

    it.each(INPUT_EVENT_TYPES)('should keep the session alive past the idle timeout when %s fires on the document', (eventType) => {
      // GIVEN a focused main window with doc X focused
      const rig = new MainWindowRig();
      rig.tracker.onDocFocused(DOC_ID, rig.main.doc);
      // WHEN the input event fires just before the idle timeout, and the
      // window blurs after the original idle deadline has passed
      vi.advanceTimersByTime(IDLE_MS - BEFORE_IDLE_MS);
      rig.stub.fire(rig.main.doc, eventType);
      vi.advanceTimersByTime(2 * BEFORE_IDLE_MS);
      rig.fire('blur');
      // THEN one session spans past the original deadline (no idle close at IDLE_MS)
      expect(rig.sink.records).toEqual([`${DOC_ID}:${IDLE_MS + BEFORE_IDLE_MS}`]);
    });
  });

  describe('popout window-open (popout opened after construction)', () => {
    it('should open a session for a doc in a popout that is focused at registration', () => {
      // GIVEN a monitor and an OS-focused popout opened after construction
      const rig = new MainWindowRig({ focused: false });
      const popout = new FakeWindow('popout', true);
      rig.openPopout(popout);
      // WHEN a doc hosted in the popout is focused for a dwell and the plugin unloads
      rig.tracker.onDocFocused(DOC_ID, popout.doc);
      vi.advanceTimersByTime(DWELL_MS);
      rig.tracker.dispose();
      // THEN the dwell was recorded — the registration-time focus check counted the popout as focused
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should wire the popout window focus/blur events to the tracker', () => {
      // GIVEN a monitor and an UNfocused popout opened after construction, hosting doc X
      const rig = new MainWindowRig({ focused: false });
      const popout = new FakeWindow('popout', false);
      rig.openPopout(popout);
      rig.tracker.onDocFocused(DOC_ID, popout.doc);
      // WHEN the popout gains OS focus, the doc dwells, and the popout blurs
      popout.focused = true;
      rig.stub.fire(popout.win, 'focus');
      vi.advanceTimersByTime(DWELL_MS);
      popout.focused = false;
      rig.stub.fire(popout.win, 'blur');
      // THEN the dwell between the popout's focus and blur was recorded
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should wire the popout document input events to the tracker', () => {
      // GIVEN an OS-focused popout opened after construction, hosting doc X
      const rig = new MainWindowRig({ focused: false });
      const popout = new FakeWindow('popout', true);
      rig.openPopout(popout);
      rig.tracker.onDocFocused(DOC_ID, popout.doc);
      // WHEN a keydown fires in the popout just before the idle timeout, and
      // the popout blurs after the original idle deadline
      vi.advanceTimersByTime(IDLE_MS - BEFORE_IDLE_MS);
      rig.stub.fire(popout.doc, 'keydown');
      vi.advanceTimersByTime(2 * BEFORE_IDLE_MS);
      rig.stub.fire(popout.win, 'blur');
      // THEN the popout keydown kept the session alive past the deadline
      expect(rig.sink.records).toEqual([`${DOC_ID}:${IDLE_MS + BEFORE_IDLE_MS}`]);
    });
  });

  describe('Settings modal in a popout window', () => {
    let rig: MainWindowRig;
    let popout: FakeWindow;

    function setPopoutSettingsOpen(open: boolean): void {
      popout.settingsOpen = open;
      const observer = FakeMutationObserver.instances.find(o => o.observedTarget === popout.body);
      if (observer === undefined) throw new Error('no observer on popout body');
      observer.trigger();
    }

    beforeEach(() => {
      // GIVEN an OS-focused popout opened after construction (main window not focused)
      rig = new MainWindowRig({ focused: false });
      popout = new FakeWindow('popout', true);
      rig.openPopout(popout);
    });

    it('should close the popout-hosted doc session when Settings opens in that popout', () => {
      // GIVEN doc X hosted in the popout, dwelling
      rig.tracker.onDocFocused(DOC_ID, popout.doc);
      vi.advanceTimersByTime(DWELL_MS);
      // WHEN Settings opens in the popout
      setPopoutSettingsOpen(true);
      // THEN the session is recorded at once (per-window Settings detection)
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should start a NEW session for the popout-hosted doc when Settings closes in that popout', () => {
      // GIVEN doc X hosted in the popout, its session closed by Settings opening there
      rig.tracker.onDocFocused(DOC_ID, popout.doc);
      vi.advanceTimersByTime(DWELL_MS);
      setPopoutSettingsOpen(true);
      // WHEN Settings closes in the popout and the doc dwells before a blur
      setPopoutSettingsOpen(false);
      vi.advanceTimersByTime(DWELL_MS);
      rig.stub.fire(popout.win, 'blur');
      // THEN a second session spans the post-Settings dwell
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`, `${DOC_ID}:${DWELL_MS}`]);
    });

    it('should NOT cut a main-hosted doc session when Settings opens in a popout while main stays focused', () => {
      // GIVEN the main window is OS-focused too and hosts doc X, dwelling
      rig.main.focused = true;
      rig.fire('focus');
      rig.tracker.onDocFocused(DOC_ID, rig.main.doc);
      vi.advanceTimersByTime(DWELL_MS);
      // WHEN Settings opens in the popout
      setPopoutSettingsOpen(true);
      // THEN nothing is recorded — Settings detection is scoped to the window it opened in
      expect(rig.sink.records).toEqual([]);
    });
  });

  describe('popout window-close', () => {
    it('should record the popout-hosted doc session when the popout closes (forwarded as a blur)', () => {
      // GIVEN an OS-focused popout opened after construction, hosting doc X
      // (main window also focused, so only the window-identity close path applies)
      const rig = new MainWindowRig();
      const popout = new FakeWindow('popout', true);
      rig.openPopout(popout);
      rig.tracker.onDocFocused(DOC_ID, popout.doc);
      vi.advanceTimersByTime(DWELL_MS);
      // WHEN the popout closes (no DOM blur fires for a closing window)
      rig.closePopout(popout);
      // THEN the session is recorded at once
      expect(rig.sink.records).toEqual([`${DOC_ID}:${DWELL_MS}`]);
    });

    it('should disconnect the closed popout body observer', () => {
      // GIVEN a monitor and a popout opened after construction
      const rig = new MainWindowRig();
      const popout = new FakeWindow('popout', false);
      rig.stub.workspaceHandlers.get('window-open')?.({ win: popout.win, doc: popout.doc });
      // WHEN the popout closes
      rig.stub.workspaceHandlers.get('window-close')?.({ win: popout.win, doc: popout.doc });
      // THEN its observer is disconnected
      const popoutObserver = FakeMutationObserver.instances.find(o => o.observedTarget === popout.body);
      expect(popoutObserver?.disconnected).toBe(true);
    });
  });
});
