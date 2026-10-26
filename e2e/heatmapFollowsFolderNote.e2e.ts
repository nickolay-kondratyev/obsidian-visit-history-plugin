// An OPEN heatmap follows folder notes: opening `Projects/Projects.md` (named like its
// folder, INSIDE it) or `Areas.md` (named like the folder NEXT TO it) drills the heatmap
// into that folder — unless the setting is turned off.
import { expect, test } from '@playwright/test';
import { CMD_OPEN_VAULT_HEATMAP, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness } from './obsidianHarness';
import { sleep } from './vhAssert';

const VIEWPORT = { width: 1200, height: 800 } as const;
const FOLDER = 'Projects';
const FOLDER_NOTE = `${FOLDER}/${FOLDER}.md`;
const SIBLING_NOTE = `${FOLDER}/Other.md`;
const SIBLING_LAYOUT_FOLDER = 'Areas';
const SIBLING_LAYOUT_FOLDER_NOTE = `${SIBLING_LAYOUT_FOLDER}.md`;
const BREADCRUMB = '.vault-heatmap-view .breadcrumb-path';
// The follow is synchronous on file-open (+ one React render); this only bounds how long
// the OFF spec waits for a drill that must never come.
const NO_FOLLOW_SETTLE_MS = 1000;

let h: ObsidianHarness | undefined;

/** GIVEN the vault heatmap open at the vault root, with a folder note in the vault. */
async function launchWithHeatmapOpen(heatmapFollowsFolderNotes?: boolean): Promise<ObsidianHarness> {
  const harness = await ObsidianHarness.launch({
    idleTimeoutSeconds: HIGH_IDLE_SECONDS,
    minFocusSecondsToRecord: 0,
    heatmapFollowsFolderNotes,
    seedFiles: [
      { path: FOLDER_NOTE, content: 'folder note' },
      { path: SIBLING_NOTE, content: 'other note' },
      { path: SIBLING_LAYOUT_FOLDER_NOTE, content: 'folder note next to its folder' },
      { path: `${SIBLING_LAYOUT_FOLDER}/Inner.md`, content: 'inner note' },
    ],
  });
  await harness.trustVaultAuthor(); // its modal would cover the heatmap
  await harness.page.setViewportSize(VIEWPORT); // the headless window boots too small to lay out
  await harness.runCommand(CMD_OPEN_VAULT_HEATMAP);
  await harness.waitForActiveViewType(VIEW_TYPE_HEATMAP);
  return harness;
}

/** Opens a file in a NEW tab, so the heatmap leaf stays open (and keeps rendering). */
async function openInNewTab(harness: ObsidianHarness, path: string): Promise<void> {
  await harness.page.evaluate(async (p) => {
    const file = window.app.vault.getAbstractFileByPath(p);
    if (!file) throw new Error(`file not found in vault: ${p}`);
    await window.app.workspace.getLeaf(true).openFile(file);
  }, path);
}

test.describe('heatmap follows folder notes', () => {
  test.afterEach(async () => {
    if (h) await h.close();
    h = undefined;
  });

  test('should drill into the folder WHEN its folder note is opened (default on)', async () => {
    h = await launchWithHeatmapOpen();

    // WHEN the folder note is opened
    await openInNewTab(h, FOLDER_NOTE);

    // THEN the heatmap shows that folder
    await expect(h.page.locator(BREADCRUMB)).toHaveText(`/${FOLDER}`);
  });

  test('should drill into the folder WHEN its folder note NEXT TO it is opened', async () => {
    h = await launchWithHeatmapOpen();

    // WHEN Areas.md (beside the Areas/ folder) is opened
    await openInNewTab(h, SIBLING_LAYOUT_FOLDER_NOTE);

    // THEN the heatmap shows that folder
    await expect(h.page.locator(BREADCRUMB)).toHaveText(`/${SIBLING_LAYOUT_FOLDER}`);
  });

  test('should stay at the vault root WHEN a non-folder note is opened', async () => {
    h = await launchWithHeatmapOpen();

    // WHEN a regular note in that folder is opened
    await openInNewTab(h, SIBLING_NOTE);
    await sleep(NO_FOLLOW_SETTLE_MS);

    // THEN the heatmap stays at the root (no breadcrumb)
    await expect(h.page.locator(BREADCRUMB)).toHaveCount(0);
  });

  test('should stay at the vault root WHEN the folder note is opened with the setting off', async () => {
    h = await launchWithHeatmapOpen(false);

    // WHEN the folder note is opened
    await openInNewTab(h, FOLDER_NOTE);
    await sleep(NO_FOLLOW_SETTLE_MS);

    // THEN the heatmap stays at the root (no breadcrumb)
    await expect(h.page.locator(BREADCRUMB)).toHaveCount(0);
  });
});
