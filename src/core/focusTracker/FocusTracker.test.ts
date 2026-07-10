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

function makeLeaf(file: TFile): WorkspaceLeaf {
  const view = {
    getViewType: () => 'markdown',
    getDisplayText: () => file.basename,
    file,
  };
  return { view: view as unknown as View } as unknown as WorkspaceLeaf;
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
});
