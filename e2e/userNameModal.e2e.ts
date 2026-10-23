// S15 — First-run user-name modal (device without a pinned user name).
// On enable the plugin asks for a user name; until one is CONFIRMED nothing is recorded.
//  - Cancel → no VH at all this session (no session line anywhere under `user/`).
//  - Confirm a new name → recording activates under `user/<name>/`, and the doc focused
//    WHILE the modal was up gets its session: activation replays the last focus event to
//    the late-registered duration listener (PluginFactory.activateUserScopedRecording).
//
// The user-name modal stacks ABOVE Obsidian's "trust the author" modal (it opens later),
// so it is clickable without dismissing the trust modal; docs are focused via the API.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B } from './constants';
import { ObsidianHarness } from './obsidianHarness';
import {
  assertNoSessionLineUnderDirWithin,
  parseDurationMs,
  pollForSessionLine,
  sleep,
  vhFilePath,
  vhUsersDir,
} from './vhAssert';

/** Keep in sync with the title in ModalUserNamePrompt (UserNamePromptModal.onOpen). */
const MODAL_TITLE = 'Choose your visit history user name';
const NEW_USER_NAME = 'e2e_modal_user';
// The headless window boots tiny (300×200) — too small to click the modal's buttons.
const VIEWPORT = { width: 1280, height: 800 } as const;
const DWELL_MS = 1000;
const POLL = { timeoutMs: 15_000 } as const;
// A→B closes A at once (no grace) — a recording plugin would write well within this.
const NO_RECORDING_WINDOW_MS = 3000;

test.describe('S15 user-name modal on an unpinned device', () => {
  let harness: ObsidianHarness | undefined;

  test.beforeEach(async () => {
    const h = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: 0,
      leaveUserNameUnpinned: true,
    });
    harness = h;
    await h.page.setViewportSize(VIEWPORT);
    await h.page.getByText(MODAL_TITLE, { exact: true }).waitFor();
    await h.openFile(FILE_A); // focused while the modal is up
    await sleep(DWELL_MS);
  });

  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  const getHarness = (): ObsidianHarness => {
    if (!harness) throw new Error('harness accessed outside a test (beforeEach did not run)');
    return harness;
  };

  test('cancelling the modal records no visit history at all', async () => {
    const h = getHarness();
    await h.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await h.page.getByText(MODAL_TITLE, { exact: true }).waitFor({ state: 'detached' });

    await h.openFile(FILE_B); // would close A's session — if anything were recording

    // AC15.1 — no session line for anyone, anywhere under `user/`.
    await assertNoSessionLineUnderDirWithin(vhUsersDir(h.vaultDir), { timeoutMs: NO_RECORDING_WINDOW_MS });
  });

  test('confirming a new name records the modal-time doc under that user', async () => {
    const h = getHarness();
    const modal = h.page.locator('.modal').filter({ hasText: MODAL_TITLE });
    await modal.getByRole('textbox').fill(NEW_USER_NAME); // replaces the OS-login pre-fill
    await modal.getByRole('button', { name: 'Confirm', exact: true }).click();
    await modal.waitFor({ state: 'detached' });

    await sleep(DWELL_MS);
    await h.openFile(FILE_B);

    // AC15.2 — A's session (opened by the activation replay) lands under the new user.
    const result = await pollForSessionLine(vhFilePath(h.vaultDir, DOC_ID_A, NEW_USER_NAME), POLL);
    expect(result.lines).toHaveLength(1);
    // Lower bound only: the replay starts the session at confirm, so it spans ~the
    // post-confirm dwell (the pre-confirm focus time is not counted).
    expect(parseDurationMs(result.firstLine)).toBeGreaterThanOrEqual(DWELL_MS / 2);
  });
});
