import { describe, expect, it } from 'vitest';
import { InFlightDropGuard } from './InFlightDropGuard';

/** Task factory whose promises resolve only when released. */
class ControlledTasks {
  readonly startedKeys: string[] = [];
  private pendingResolvers: (() => void)[] = [];

  task(key: string): () => Promise<void> {
    return () => {
      this.startedKeys.push(key);
      return new Promise(resolve => this.pendingResolvers.push(resolve));
    };
  }

  releaseAll(): void {
    this.pendingResolvers.forEach(resolve => resolve());
    this.pendingResolvers = [];
  }
}

describe('InFlightDropGuard', () => {
  describe('run', () => {
    it('should DROP a duplicate run while one is in flight for the same key', async () => {
      // GIVEN an in-flight task for key 'a'
      const guard = new InFlightDropGuard();
      const tasks = new ControlledTasks();
      const first = guard.run('a', tasks.task('a'));
      // WHEN a second run for the same key arrives
      const second = guard.run('a', tasks.task('a'));
      tasks.releaseAll();
      await Promise.all([first, second]);
      // THEN the task only started once
      expect(tasks.startedKeys).toEqual(['a']);
    });

    it('should run concurrent tasks for DIFFERENT keys independently', async () => {
      // GIVEN an in-flight task for key 'a'
      const guard = new InFlightDropGuard();
      const tasks = new ControlledTasks();
      const first = guard.run('a', tasks.task('a'));
      // WHEN a run for key 'b' arrives concurrently
      const second = guard.run('b', tasks.task('b'));
      tasks.releaseAll();
      await Promise.all([first, second]);
      // THEN both started
      expect(tasks.startedKeys).toEqual(['a', 'b']);
    });

    it('should run again for the same key after the first run completed', async () => {
      // GIVEN a completed run
      const guard = new InFlightDropGuard();
      const tasks = new ControlledTasks();
      const first = guard.run('a', tasks.task('a'));
      tasks.releaseAll();
      await first;
      // WHEN running the same key again
      const second = guard.run('a', tasks.task('a'));
      tasks.releaseAll();
      await second;
      // THEN it ran (guard entry cleaned up)
      expect(tasks.startedKeys).toEqual(['a', 'a']);
    });

    it('should rethrow the task error and clean up the guard entry', async () => {
      // GIVEN a task that fails
      const guard = new InFlightDropGuard();
      await expect(guard.run('a', async () => {
        throw new Error('task failed');
      })).rejects.toThrow('task failed');
      // WHEN running the same key after the failure
      let ran = false;
      await guard.run('a', async () => {
        ran = true;
      });
      // THEN the second run executes (cleanup happened in finally)
      expect(ran).toBe(true);
    });
  });
});
