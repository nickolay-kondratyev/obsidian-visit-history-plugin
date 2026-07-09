import { describe, expect, it } from 'vitest';
import { View } from 'obsidian';
import { IsTrackedProviderDefault } from './IsTrackedProvider';
import { makeTFile } from '../../../testSupport/fileFactory';

const provider = new IsTrackedProviderDefault();

/** Builds the minimal View shape the provider inspects (system boundary). */
function makeView(viewType: string, filePath: string | null): View {
  return {
    getViewType: () => viewType,
    file: filePath === null ? null : makeTFile({ path: filePath }),
  } as unknown as View;
}

describe('IsTrackedProviderDefault', () => {
  describe('isTrackedFile', () => {
    it('should track md files', () => {
      expect(provider.isTrackedFile(makeTFile({ path: 'notes/a.md' }))).toBe(true);
    });

    it('should track canvas files', () => {
      expect(provider.isTrackedFile(makeTFile({ path: 'b.canvas' }))).toBe(true);
    });

    it('should NOT track files inside _visit_history (no self-tracking loops)', () => {
      expect(provider.isTrackedFile(makeTFile({ path: '_visit_history/v1/focus/mac/_vh_01A.md' }))).toBe(false);
    });

    it('should NOT track unsupported extensions', () => {
      expect(provider.isTrackedFile(makeTFile({ path: 'image.png' }))).toBe(false);
    });
  });

  describe('isTrackedView', () => {
    it('should track a markdown view with a file', () => {
      expect(provider.isTrackedView(makeView('markdown', 'notes/a.md'))).toBe(true);
    });

    it('should NOT track a null view', () => {
      expect(provider.isTrackedView(null)).toBe(false);
    });

    it('should NOT track an untracked view type', () => {
      expect(provider.isTrackedView(makeView('graph', 'notes/a.md'))).toBe(false);
    });

    it('should NOT track a view without a file', () => {
      expect(provider.isTrackedView(makeView('markdown', null))).toBe(false);
    });

    it('should NOT track a view showing a visit history file', () => {
      expect(provider.isTrackedView(makeView('markdown', '_visit_history/v1/focus/mac/_vh_01A.md'))).toBe(false);
    });
  });
});
