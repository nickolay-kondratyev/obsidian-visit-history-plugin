// Shared test-lifecycle fixture: one place to launch a fresh real-Obsidian harness in
// beforeEach and close it in afterEach. Keeps the per-spec boilerplate (let h + hooks +
// the HIGH_IDLE constant) DRY so the launch/close contract has a single source of truth.
import { test } from '@playwright/test';
import { DevConfigOverrides, ObsidianHarness } from './obsidianHarness';

/** Idle timeout high enough that the idle timer never fires during a brief dwell. */
export const HIGH_IDLE_SECONDS = 180;

/**
 * Registers `beforeEach` launch + `afterEach` close for the enclosing describe and returns
 * a getter for the live harness. Call inside a `test.describe` block. Pass
 * `devConfigOverrides` to write a dev overrides file the plugin reads via env
 * (bypasses hard-limited config such as the min-5 s idle floor).
 *
 * `minFocusSecondsToRecord` defaults to 0 — the min-focus filter is OFF unless a
 * spec explicitly tests it, so existing specs' ~0 ms session lines are recorded.
 */
export function useHarness(
  idleTimeoutSeconds: number,
  devConfigOverrides?: DevConfigOverrides,
  minFocusSecondsToRecord = 0,
): () => ObsidianHarness {
  let harness: ObsidianHarness | undefined;
  test.beforeEach(async () => {
    harness = await ObsidianHarness.launch({ idleTimeoutSeconds, minFocusSecondsToRecord, devConfigOverrides });
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
