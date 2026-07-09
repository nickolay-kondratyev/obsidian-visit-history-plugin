import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { VisitHistoryFocusListenerDefault } from './VisitHistoryFocusListenerDefault';
import { VisitHistoryService } from '../../service/visitHistoryService/VisitHistoryService';
import { FocusEvent } from '../FocusTracker';
import { makeTFile } from '../../../testSupport/fileFactory';

/** Service fake whose recordVisit promises resolve only when released. */
class ControlledVisitHistoryService implements VisitHistoryService {
  readonly recordedPaths: string[] = [];
  private pendingResolvers: (() => void)[] = [];

  recordVisitNowOnFocus(file: TFile): Promise<void> {
    this.recordedPaths.push(file.path);
    return new Promise(resolve => this.pendingResolvers.push(resolve));
  }

  releaseAll(): void {
    this.pendingResolvers.forEach(resolve => resolve());
    this.pendingResolvers = [];
  }

  async getLastVisitStamp(): Promise<number | null> {
    return null;
  }
}

function focusEvent(path: string): FocusEvent {
  return { type: 'markdown', title: path, file: makeTFile({ path }) };
}

describe('VisitHistoryFocusListenerDefault', () => {
  describe('onFocus', () => {
    it('should DROP a duplicate focus event while one is in flight for the same path', async () => {
      // GIVEN an onFocus still awaiting the service
      const service = new ControlledVisitHistoryService();
      const listener = new VisitHistoryFocusListenerDefault(service);
      const first = listener.onFocus(focusEvent('notes/a.md'));
      // WHEN a second focus event for the same path arrives
      const second = listener.onFocus(focusEvent('notes/a.md'));
      service.releaseAll();
      await Promise.all([first, second]);
      // THEN the service was only called once (DROP semantics)
      expect(service.recordedPaths).toEqual(['notes/a.md']);
    });

    it('should process concurrent focus events for DIFFERENT paths independently', async () => {
      // GIVEN an in-flight onFocus for note a
      const service = new ControlledVisitHistoryService();
      const listener = new VisitHistoryFocusListenerDefault(service);
      const first = listener.onFocus(focusEvent('notes/a.md'));
      // WHEN a focus event for note b arrives concurrently
      const second = listener.onFocus(focusEvent('notes/b.md'));
      service.releaseAll();
      await Promise.all([first, second]);
      // THEN both are recorded
      expect(service.recordedPaths).toEqual(['notes/a.md', 'notes/b.md']);
    });

    it('should process a second focus for the same path after the first completed', async () => {
      // GIVEN a completed onFocus
      const service = new ControlledVisitHistoryService();
      const listener = new VisitHistoryFocusListenerDefault(service);
      const first = listener.onFocus(focusEvent('notes/a.md'));
      service.releaseAll();
      await first;
      // WHEN focusing the same path again
      const second = listener.onFocus(focusEvent('notes/a.md'));
      service.releaseAll();
      await second;
      // THEN it is recorded (in-flight guard cleaned up)
      expect(service.recordedPaths).toEqual(['notes/a.md', 'notes/a.md']);
    });

    it('should clean up the in-flight guard when the service throws', async () => {
      // GIVEN a service that fails on the first call
      let shouldThrow = true;
      const recordedPaths: string[] = [];
      const service: VisitHistoryService = {
        async recordVisitNowOnFocus(file: TFile): Promise<void> {
          recordedPaths.push(file.path);
          if (shouldThrow) throw new Error('vault write failed');
        },
        async getLastVisitStamp(): Promise<number | null> {
          return null;
        },
      };
      const listener = new VisitHistoryFocusListenerDefault(service);
      await expect(listener.onFocus(focusEvent('notes/a.md'))).rejects.toThrow('vault write failed');
      // WHEN focusing again after the failure
      shouldThrow = false;
      await listener.onFocus(focusEvent('notes/a.md'));
      // THEN the second focus is processed (guard was cleaned up in finally)
      expect(recordedPaths).toEqual(['notes/a.md', 'notes/a.md']);
    });

    it('should drop events without a file path', async () => {
      // GIVEN an event whose file has no path
      const service = new ControlledVisitHistoryService();
      const listener = new VisitHistoryFocusListenerDefault(service);
      // WHEN focusing
      await listener.onFocus(focusEvent(''));
      // THEN nothing is recorded
      expect(service.recordedPaths).toEqual([]);
    });
  });
});
