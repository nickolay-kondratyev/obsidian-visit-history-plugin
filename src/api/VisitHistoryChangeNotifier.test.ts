import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitHistoryChangeNotifier } from './VisitHistoryChangeNotifier';

describe('VisitHistoryChangeNotifier', () => {
  let notifier: VisitHistoryChangeNotifier;

  beforeEach(() => {
    notifier = new VisitHistoryChangeNotifier();
    // Expected console.error from the throwing-subscriber tests; keeps output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('notify', () => {
    it('should call every subscriber', () => {
      // GIVEN two subscribers
      const calls: string[] = [];
      notifier.subscribe(() => calls.push('a'));
      notifier.subscribe(() => calls.push('b'));
      // WHEN notifying
      notifier.notify();
      // THEN both were called
      expect(calls).toEqual(['a', 'b']);
    });

    it('should still call later subscribers WHEN an earlier one throws', () => {
      // GIVEN a throwing subscriber before a healthy one
      let healthyCalls = 0;
      notifier.subscribe(() => {
        throw new Error('consumer bug');
      });
      notifier.subscribe(() => healthyCalls++);
      // WHEN notifying
      notifier.notify();
      // THEN the healthy one was still called
      expect(healthyCalls).toBe(1);
    });

    it('should not throw to the notifying caller WHEN a subscriber throws', () => {
      // GIVEN a throwing subscriber
      notifier.subscribe(() => {
        throw new Error('consumer bug');
      });
      // WHEN notifying
      // THEN our own flow is unaffected
      expect(() => notifier.notify()).not.toThrow();
    });

    it('should log the error WHEN a subscriber throws', () => {
      // GIVEN a throwing subscriber
      notifier.subscribe(() => {
        throw new Error('consumer bug');
      });
      // WHEN notifying
      notifier.notify();
      // THEN the failure was logged
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('should stop calling a subscriber AFTER its unsubscribe', () => {
      // GIVEN an unsubscribed subscriber
      let calls = 0;
      const unsubscribe = notifier.subscribe(() => calls++);
      unsubscribe();
      // WHEN notifying
      notifier.notify();
      // THEN it was not called
      expect(calls).toBe(0);
    });

    it('should keep the other subscription WHEN the same callback subscribed twice and one unsubscribes', () => {
      // GIVEN one callback subscribed twice, one subscription dropped
      let calls = 0;
      const callback = (): void => {
        calls++;
      };
      const unsubscribeFirst = notifier.subscribe(callback);
      notifier.subscribe(callback);
      unsubscribeFirst();
      // WHEN notifying
      notifier.notify();
      // THEN the remaining subscription still fires
      expect(calls).toBe(1);
    });
  });

  describe('dispose', () => {
    it('should drop every subscriber', () => {
      // GIVEN a subscriber
      let calls = 0;
      notifier.subscribe(() => calls++);
      // WHEN disposed, then notified
      notifier.dispose();
      notifier.notify();
      // THEN it was not called
      expect(calls).toBe(0);
    });

    it('should ignore subscriptions made AFTER dispose', () => {
      // GIVEN a disposed notifier
      notifier.dispose();
      let calls = 0;
      notifier.subscribe(() => calls++);
      // WHEN notifying
      notifier.notify();
      // THEN the late subscriber was not called
      expect(calls).toBe(0);
    });
  });
});
