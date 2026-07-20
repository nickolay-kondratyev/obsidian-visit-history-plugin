import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { WindowActivityMonitor } from './WindowActivityMonitor';
import { FocusDurationSink, FocusDurationTracker, UNFOCUS_GRACE_MS, WindowTimers } from './FocusDurationTracker';

const IDLE_MS = 180_000;

// Built at CALL time (inside a test, after vi.useFakeTimers) so the shorthand
// captures the FAKE clock; advanceTimersByTime then drives the tracker.
function fakeTimers(): WindowTimers {
  return { setTimeout, clearTimeout };
}

interface FakeWindowBundle {
  win: Window;
  doc: Document;
}

/** Fake OS window: just the members the monitor touches (node has no DOM). */
function makeFakeWindow(name: string, focused: boolean): FakeWindowBundle {
  const win = { name } as unknown as Window;
  const doc = {
    name,
    hidden: false,
    hasFocus: () => focused,
    defaultView: win,
  } as unknown as Document;
  return { win, doc };
}

interface DomRegistration {
  target: unknown;
  type: string;
}

interface StubPluginBundle {
  plugin: Plugin;
  domRegistrations: DomRegistration[];
}

/**
 * Stub plugin whose workspace already CONTAINS the given leaves — models a
 * plugin (re)load while popout windows are open.
 */
function makeStubPlugin(leafOwnerDocuments: Document[]): StubPluginBundle {
  const domRegistrations: DomRegistration[] = [];
  const stub = {
    registerDomEvent: (target: unknown, type: string) => {
      domRegistrations.push({ target, type });
    },
    registerEvent: () => undefined,
    app: {
      workspace: {
        on: () => ({}),
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
  return { plugin: stub as unknown as Plugin, domRegistrations };
}

class RecordingSink implements FocusDurationSink {
  readonly records: string[] = [];

  recordFocusDuration(docId: string, _focusStartEpochMs: number, durationMs: number): void {
    this.records.push(`${docId}:${durationMs}`);
  }
}

describe('WindowActivityMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.parse('2026-07-09T22:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('popouts already open at construction (plugin reload/update)', () => {
    it('should track durations for a doc focused in a PRE-EXISTING popout', () => {
      // GIVEN Obsidian with an OS-focused popout that existed before the
      // plugin loaded ('window-open' never fires for it)
      const main = makeFakeWindow('main', false);
      const popout = makeFakeWindow('popout', true);
      const { plugin } = makeStubPlugin([popout.doc]);
      const sink = new RecordingSink();
      const tracker = new FocusDurationTracker(sink, () => IDLE_MS, fakeTimers());
      new WindowActivityMonitor(plugin, tracker, main.win, main.doc);
      // WHEN a doc hosted in that popout is focused for 5s, unfocused, and
      // the unfocus grace resolves
      tracker.onDocFocused('X', popout.doc);
      vi.advanceTimersByTime(5000);
      tracker.onDocUnfocused();
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      // THEN its session was recorded — the popout counts as a focused window
      expect(sink.records).toEqual(['X:5000']);
    });

    it('should register DOM listeners on the pre-existing popout window', () => {
      // GIVEN a pre-existing popout
      const main = makeFakeWindow('main', true);
      const popout = makeFakeWindow('popout', false);
      const { plugin, domRegistrations } = makeStubPlugin([popout.doc]);
      // WHEN the monitor is constructed
      new WindowActivityMonitor(plugin, new FocusDurationTracker(new RecordingSink(), () => IDLE_MS, fakeTimers()), main.win, main.doc);
      // THEN the popout window got its blur listener (focus/activity come with it)
      expect(domRegistrations.filter(r => r.target === popout.win && r.type === 'blur')).toHaveLength(1);
    });

    it('should register each window exactly ONCE despite multiple leaves in it', () => {
      // GIVEN two leaves in one popout plus a main-window leaf
      const main = makeFakeWindow('main', true);
      const popout = makeFakeWindow('popout', false);
      const { plugin, domRegistrations } = makeStubPlugin([popout.doc, popout.doc, main.doc]);
      // WHEN the monitor is constructed
      new WindowActivityMonitor(plugin, new FocusDurationTracker(new RecordingSink(), () => IDLE_MS, fakeTimers()), main.win, main.doc);
      // THEN no window carries duplicate listeners (events would double-fire)
      expect(domRegistrations.filter(r => r.type === 'blur').map(r => r.target)).toEqual([main.win, popout.win]);
    });
  });
});
