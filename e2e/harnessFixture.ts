// Shared test-lifecycle fixture: one place to launch a fresh real-Obsidian harness in
// beforeEach and close it in afterEach. Keeps the per-spec boilerplate (let h + hooks +
// the HIGH_IDLE constant) DRY so the launch/close contract has a single source of truth.
import { test } from '@playwright/test';
import { ObsidianHarness } from './obsidianHarness';

/** Idle timeout high enough that the idle timer never fires during a brief dwell. */
export const HIGH_IDLE_SECONDS = 180;

/**
 * Registers `beforeEach` launch + `afterEach` close for the enclosing describe and returns
 * a getter for the live harness. Call inside a `test.describe` block.
 */
export function useHarness(idleTimeoutSeconds: number): () => ObsidianHarness {
  let harness: ObsidianHarness | undefined;
  test.beforeEach(async () => {
    harness = await ObsidianHarness.launch({ idleTimeoutSeconds });
  });
  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });
  return () => {
    if (!harness) throw new Error('harness accessed outside a test (beforeEach did not run)');
    return harness;
  };
}
