import { describe, expect, it } from 'vitest';
import { Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';
import { FocusEvent, FocusListener, FocusTracker } from './FocusTracker';
import { IsTrackedProvider } from '../util/vault/IsTrackedProvider';
import { makeTFile } from '../../testSupport/fileFactory';

type LeafChangeCallback = (leaf: WorkspaceLeaf | null) => void;

/** Captures the active-leaf-change callback so tests can fire events directly. */
function makeStubPlugin(): { plugin: Plugin; fireLeafChange: LeafChangeCallback } {
  let captured: LeafChangeCallback | null = null;
  const stub = {
    registerEvent: () => undefined,
    app: {
      workspace: {
        on: (_name: string, callback: LeafChangeCallback) => {
          captured = callback;
          return {};
        },
      },
    },
  };
  // System boundary: FocusTracker only touches registerEvent + workspace.on.
  const plugin = stub as unknown as Plugin;
  return {
    plugin,
    fireLeafChange: (leaf) => {
      if (captured === null) throw new Error('leaf-change callback was not registered');
      captured(leaf);
    },
  };
}

const trackAllProvider: IsTrackedProvider = {
  isTrackedFile: () => true,
  isTrackedView: (view) => view !== null,
};

// Mirrors production filtering: only markdown views are tracked — used by
// tests that navigate to untracked view types (e.g. a PDF).
const markdownOnlyProvider: IsTrackedProvider = {
  isTrackedFile: () => true,
  isTrackedView: (view) => view !== null && view.getViewType() === 'markdown',
};

// Stand-in for the hosting window's document (node tests have no DOM).
const OWNER_DOC = { name: 'main-window-doc' };

function makeView(file: TFile, viewType = 'markdown'): View {
  const view = {
    getViewType: () => viewType,
    getDisplayText: () => file.basename,
    file,
    containerEl: { ownerDocument: OWNER_DOC },
  };
  return view as unknown as View;
}

/** Leaf whose view is swappable — models same-leaf navigation. */
function makeMutableLeaf(view: View): WorkspaceLeaf & { view: View } {
  return { view } as unknown as WorkspaceLeaf & { view: View };
}

function makeLeaf(file: TFile): WorkspaceLeaf {
  return makeMutableLeaf(makeView(file));
}


class RecordingListener implements FocusListener {
  readonly calls: string[] = [];
  /** When set, onFocus for this path awaits the gate before returning. */
  gate: { path: string; promise: Promise<void> } | null = null;

  async onFocus(event: FocusEvent): Promise<void> {
    if (this.gate && this.gate.path === event.file.path) {
      await this.gate.promise;
    }
    this.calls.push(`focus:${event.file.path}`);
  }

  async onUnfocus(event: FocusEvent): Promise<void> {
    this.calls.push(`unfocus:${event.file.path}`);
  }
}

describe('FocusTracker', () => {
  describe('event dispatch', () => {
    it('should dispatch unfocus of the previous leaf before focus of the next', async () => {
      // GIVEN a tracker with one listener and note A focused
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const listener = new RecordingListener();
      tracker.registerListener(listener);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      await tracker.whenIdle();
      // WHEN navigating to note B
      fireLeafChange(makeLeaf(makeTFile({ path: 'b.md' })));
      await tracker.whenIdle();
      // THEN order is focus A, unfocus A, focus B
      expect(listener.calls).toEqual(['focus:a.md', 'unfocus:a.md', 'focus:b.md']);
    });

    it('should keep events in order even when a listener is slow (serialized dispatch)', async () => {
      // GIVEN a listener whose focus handling of note A blocks on IO
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const listener = new RecordingListener();
      let releaseGate!: () => void;
      listener.gate = {
        path: 'a.md',
        promise: new Promise((resolve) => {
          releaseGate = resolve;
        }),
      };
      tracker.registerListener(listener);
      // WHEN two leaf changes fire before A's focus handling completes
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      fireLeafChange(makeLeaf(makeTFile({ path: 'b.md' })));
      releaseGate();
      await tracker.whenIdle();
      // THEN the second event was NOT interleaved ahead of the first
      expect(listener.calls).toEqual(['focus:a.md', 'unfocus:a.md', 'focus:b.md']);
    });

    it('should dispatch unfocus when same-leaf navigation lands on an UNTRACKED view (e.g. a PDF)', async () => {
      // GIVEN note A focused in a leaf
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, markdownOnlyProvider);
      const listener = new RecordingListener();
      tracker.registerListener(listener);
      const leaf = makeMutableLeaf(makeView(makeTFile({ path: 'a.md' })));
      fireLeafChange(leaf);
      await tracker.whenIdle();
      // WHEN the SAME leaf navigates to an untracked view (its view is replaced)
      leaf.view = makeView(makeTFile({ path: 'doc.pdf' }), 'pdf');
      fireLeafChange(leaf);
      await tracker.whenIdle();
      // THEN note A was unfocused — its V3 session must not keep running
      expect(listener.calls).toEqual(['focus:a.md', 'unfocus:a.md']);
    });

    it('should dispatch unfocus of the old file on same-leaf navigation between two tracked files', async () => {
      // GIVEN note A focused in a leaf
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, markdownOnlyProvider);
      const listener = new RecordingListener();
      tracker.registerListener(listener);
      const leaf = makeMutableLeaf(makeView(makeTFile({ path: 'a.md' })));
      fireLeafChange(leaf);
      await tracker.whenIdle();
      // WHEN the SAME leaf navigates to note B
      leaf.view = makeView(makeTFile({ path: 'b.md' }));
      fireLeafChange(leaf);
      await tracker.whenIdle();
      // THEN the event stream is symmetric with different-leaf navigation
      expect(listener.calls).toEqual(['focus:a.md', 'unfocus:a.md', 'focus:b.md']);
    });

    it('should NOT dispatch unfocus on a duplicate event for the same focused file', async () => {
      // GIVEN note A focused
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const listener = new RecordingListener();
      tracker.registerListener(listener);
      const leaf = makeLeaf(makeTFile({ path: 'a.md' }));
      fireLeafChange(leaf);
      await tracker.whenIdle();
      // WHEN Obsidian re-fires active-leaf-change for the same leaf and file
      fireLeafChange(leaf);
      await tracker.whenIdle();
      // THEN no unfocus was interleaved (a V3 session must not fragment)
      expect(listener.calls).toEqual(['focus:a.md', 'focus:a.md']);
    });

    it('should NOT dispatch unfocus when the same file is refocused in a DIFFERENT leaf', async () => {
      // GIVEN note A focused in leaf 1
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const listener = new RecordingListener();
      tracker.registerListener(listener);
      const file = makeTFile({ path: 'a.md' });
      fireLeafChange(makeLeaf(file));
      await tracker.whenIdle();
      // WHEN the same file gains focus in another leaf (split pane / drag-out)
      fireLeafChange(makeLeaf(file));
      await tracker.whenIdle();
      // THEN no unfocus was interleaved (a V3 session must not fragment)
      expect(listener.calls).toEqual(['focus:a.md', 'focus:a.md']);
    });

    it('should dispatch unfocus when the active leaf becomes null', async () => {
      // GIVEN note A focused
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const listener = new RecordingListener();
      tracker.registerListener(listener);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      await tracker.whenIdle();
      // WHEN the active leaf goes away
      fireLeafChange(null);
      await tracker.whenIdle();
      // THEN note A was unfocused
      expect(listener.calls).toEqual(['focus:a.md', 'unfocus:a.md']);
    });

    it('should NOT deliver past events to a listener registered late (no implicit catch-up)', async () => {
      // GIVEN note A focused before the listener exists
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      await tracker.whenIdle();
      // WHEN a listener registers afterwards (no replay requested)
      const lateListener = new RecordingListener();
      tracker.registerListener(lateListener);
      await tracker.whenIdle();
      // THEN it saw nothing — catch-up is explicit via replayLastFocusTo
      expect(lateListener.calls).toEqual([]);
    });

    it('should keep dispatching after a leaf-change event whose listener threw', async () => {
      // GIVEN a listener that throws on the first focus
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const listener = new RecordingListener();
      const throwing: FocusListener = {
        onFocus: async () => {
          throw new Error('boom');
        },
        onUnfocus: async () => undefined,
      };
      tracker.registerListener(throwing);
      tracker.registerListener(listener);
      // WHEN two leaf changes fire
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      fireLeafChange(makeLeaf(makeTFile({ path: 'b.md' })));
      await tracker.whenIdle();
      // THEN the recording listener still received everything in order
      expect(listener.calls).toEqual(['focus:a.md', 'unfocus:a.md', 'focus:b.md']);
    });
  });

  describe('replayLastFocusTo', () => {
    it('should deliver the last dispatched focus to a late-registered listener', async () => {
      // GIVEN note A focused before the late listener exists
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      await tracker.whenIdle();
      // WHEN the listener registers late and requests a replay
      const lateListener = new RecordingListener();
      tracker.registerListener(lateListener);
      tracker.replayLastFocusTo(lateListener);
      await tracker.whenIdle();
      // THEN it received the missed focus
      expect(lateListener.calls).toEqual(['focus:a.md']);
    });

    it('should deliver nothing when no focus event was ever dispatched', async () => {
      // GIVEN a tracker that never saw a tracked leaf
      const { plugin } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      // WHEN a late listener requests a replay
      const lateListener = new RecordingListener();
      tracker.registerListener(lateListener);
      tracker.replayLastFocusTo(lateListener);
      await tracker.whenIdle();
      // THEN nothing was delivered
      expect(lateListener.calls).toEqual([]);
    });

    it('should deliver nothing when the doc was unfocused before the replay ran', async () => {
      // GIVEN note A focused, then unfocused (active leaf gone)
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      fireLeafChange(null);
      await tracker.whenIdle();
      // WHEN a late listener requests a replay
      const lateListener = new RecordingListener();
      tracker.registerListener(lateListener);
      tracker.replayLastFocusTo(lateListener);
      await tracker.whenIdle();
      // THEN no stale focus was delivered (a session must not open for an unfocused doc)
      expect(lateListener.calls).toEqual([]);
    });

    it('should NOT re-deliver the focus to already-registered listeners', async () => {
      // GIVEN an early listener that saw note A's focus live
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const earlyListener = new RecordingListener();
      tracker.registerListener(earlyListener);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      await tracker.whenIdle();
      // WHEN a late listener requests a replay
      const lateListener = new RecordingListener();
      tracker.registerListener(lateListener);
      tracker.replayLastFocusTo(lateListener);
      await tracker.whenIdle();
      // THEN the early listener saw the focus exactly once
      expect(earlyListener.calls).toEqual(['focus:a.md']);
    });

    it('should replay the focus CURRENT after pending leaf-changes settle (serialized with dispatch)', async () => {
      // GIVEN an early listener blocking note A's focus while a change to note B is queued
      const { plugin, fireLeafChange } = makeStubPlugin();
      const tracker = new FocusTracker(plugin, trackAllProvider);
      const earlyListener = new RecordingListener();
      let releaseGate!: () => void;
      earlyListener.gate = {
        path: 'a.md',
        promise: new Promise((resolve) => {
          releaseGate = resolve;
        }),
      };
      tracker.registerListener(earlyListener);
      fireLeafChange(makeLeaf(makeTFile({ path: 'a.md' })));
      fireLeafChange(makeLeaf(makeTFile({ path: 'b.md' })));
      // WHEN a replay is requested before the queue drains (listener kept
      // unregistered so it can ONLY receive the replayed event)
      const lateListener = new RecordingListener();
      tracker.replayLastFocusTo(lateListener);
      releaseGate();
      await tracker.whenIdle();
      // THEN it got the focus current AFTER the queue — never stale note A
      expect(lateListener.calls).toEqual(['focus:b.md']);
    });
  });
});
