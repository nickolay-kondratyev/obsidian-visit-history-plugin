// S17 — Real user input after an idle close starts a NEW session.
// A dev override sets a sub-floor 1 s idle (as S6). A's first session idle-closes with
// no input. Then REAL input (a CDP-dispatched mouse move — the browser's own event
// path, not a synthetic dispatchEvent) on the main window must reopen a session for the
// still-current A; switching to B closes it → A has exactly 2 lines. Proves the DOM
// input → WindowActivityMonitor → tracker wiring inside real Obsidian.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B } from './constants';
import { useHarness } from './harnessFixture';
import { pollForSessionLine, pollUntil, sessionLines, sleep, vhFilePath } from './vhAssert';

const SETTINGS_IDLE_SECONDS = 180;
const OVERRIDE_IDLE_SECONDS = 1;
// Two points inside the headless window (it boots at 300×200): a real move between them.
const MOUSE_FROM = { x: 50, y: 50 } as const;
const MOUSE_TO = { x: 120, y: 90 } as const;
// Brief dwell on the resumed session — under the 1 s idle, so B's switch closes it.
const RESUMED_DWELL_MS = 300;
const POLL = { timeoutMs: 10_000 } as const;
// Bounded margin after the second line: nothing focuses A again, so a third is a bug.
const NO_THIRD_LINE_WINDOW_MS = 2000;

test.describe('S17 user input resumes after an idle close', () => {
  const getHarness = useHarness(SETTINGS_IDLE_SECONDS, { idleTimeoutSeconds: OVERRIDE_IDLE_SECONDS });

  test('a real mouse move after idle opens a new session for A', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);

    await h.openFile(FILE_A);
    // AC17.1 — the first session idle-closes (no input yet).
    await pollForSessionLine(aFile, POLL);

    await h.page.mouse.move(MOUSE_FROM.x, MOUSE_FROM.y);
    await h.page.mouse.move(MOUSE_TO.x, MOUSE_TO.y);
    await sleep(RESUMED_DWELL_MS);
    await h.openFile(FILE_B);

    // AC17.2 — the input reopened a session for A that closed on the B switch.
    await pollUntil(() => sessionLines(aFile).length >= 2, 'a second session line for A', POLL);
    await sleep(NO_THIRD_LINE_WINDOW_MS);
    expect(sessionLines(aFile)).toHaveLength(2);
  });
});
