import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { DocIdFocusListener } from './DocIdFocusListener';
import { DocIdService } from '../../service/docId/DocIdService';
import { FocusEvent } from '../FocusTracker';
import { makeTFile } from '../../../testSupport/fileFactory';

/** Service fake whose ensureDocId promises resolve only when released. */
class ControlledDocIdService implements DocIdService {
  readonly ensuredPaths: string[] = [];
  private pendingResolvers: ((id: string | null) => void)[] = [];

  ensureDocId(file: TFile): Promise<string | null> {
    this.ensuredPaths.push(file.path);
    return new Promise(resolve => this.pendingResolvers.push(resolve));
  }

  releaseAll(): void {
    this.pendingResolvers.forEach(resolve => resolve(null));
    this.pendingResolvers = [];
  }

  async getDocId(_file: TFile): Promise<string | null> {
    return null;
  }

  isEligible(_file: TFile): boolean {
    return true;
  }
}

function focusEvent(path: string): FocusEvent {
  return { type: 'markdown', title: path, file: makeTFile({ path }) };
}

describe('DocIdFocusListener', () => {
  describe('onFocus', () => {
    it('should ensure the doc id for the focused file', async () => {
      // GIVEN
      const service = new ControlledDocIdService();
      const listener = new DocIdFocusListener(service);
      // WHEN
      const focus = listener.onFocus(focusEvent('notes/a.md'));
      service.releaseAll();
      await focus;
      // THEN
      expect(service.ensuredPaths).toEqual(['notes/a.md']);
    });

    it('should DROP a duplicate focus event while one is in flight for the same path', async () => {
      // GIVEN an in-flight onFocus
      const service = new ControlledDocIdService();
      const listener = new DocIdFocusListener(service);
      const first = listener.onFocus(focusEvent('notes/a.md'));
      // WHEN a second focus for the same path arrives
      const second = listener.onFocus(focusEvent('notes/a.md'));
      service.releaseAll();
      await Promise.all([first, second]);
      // THEN the service was only called once
      expect(service.ensuredPaths).toEqual(['notes/a.md']);
    });

    it('should drop events without a file path', async () => {
      // GIVEN an event whose file has no path
      const service = new ControlledDocIdService();
      const listener = new DocIdFocusListener(service);
      // WHEN
      await listener.onFocus(focusEvent(''));
      // THEN
      expect(service.ensuredPaths).toEqual([]);
    });
  });
});
