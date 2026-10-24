// A synced git vault: every note shares the download time as its modified time, but the
// real last-change times are in git history. "Restore from git" on the heatmap's
// clustered-timestamps banner must set each committed, unchanged note's modified time to
// its last commit time — on disk AND in Obsidian's file cache — without touching content,
// skip a note edited since its last commit, and leave the banner gone.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { CMD_OPEN_VAULT_HEATMAP, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness, type LaunchOptions } from './obsidianHarness';
import { pollUntil } from './vhAssert';

const NOTE_COUNT = 24;
/** note-0 … note-9 change in the second commit; the rest are unchanged since the first. */
const CHANGED_IN_SECOND_COMMIT = 10;
/** Edited after its last commit — its current (sync) modified time is real and must stay. */
const DIRTY_NOTE_INDEX = NOTE_COUNT - 1;
const FIRST_COMMIT_MS = Date.parse('2026-01-10T10:00:00.000Z');
const SECOND_COMMIT_MS = Date.parse('2026-03-10T10:00:00.000Z');
const SYNC_TIME_MS = Date.parse('2026-10-15T10:00:00.000Z');
const MS_PER_SECOND = 1000;
const RESTORE_TIMEOUT_MS = 30_000;
const VIEWPORT = { width: 1200, height: 800 } as const;
const BANNER = '.vault-heatmap-view #header .hdr-cluster-banner';
const RESTORE_BUTTON = '.vault-heatmap-view #header .hdr-git-restore-btn';
// Filled from the same stats update that carries the banner finding (see heatmapClusteredTimestamps).
const FILE_COUNT_STAT = '.vault-heatmap-view .stats .stat strong';
// The committed seed vault's A.md, B.md, C.canvas (copied per launch, stamped "now").
const DEV_VAULT_FILE_COUNT = 3;

function notePath(i: number): string {
  return `notes/note-${i}.md`;
}

/** note-0 has CRLF line endings: the restore must keep them byte for byte. */
function firstVersion(i: number): string {
  return i === 0 ? 'note 0\r\nfirst\r\n' : `note ${i}\nfirst\n`;
}

function secondVersion(i: number): string {
  return i === 0 ? 'note 0\r\nsecond\r\n' : `note ${i}\nsecond\n`;
}

function expectedRestoredMtime(i: number): number {
  if (i === DIRTY_NOTE_INDEX) return SYNC_TIME_MS;
  return i < CHANGED_IN_SECOND_COMMIT ? SECOND_COMMIT_MS : FIRST_COMMIT_MS;
}

function writeNote(vaultDir: string, path: string, text: string): void {
  mkdirSync(dirname(join(vaultDir, path)), { recursive: true });
  writeFileSync(join(vaultDir, path), text);
}

/** Runs git in the vault with author/committer date pinned (isolated from the host's git config). */
function git(vaultDir: string, atMs: number, ...args: string[]): void {
  const date = `@${atMs / MS_PER_SECOND} +0000`;
  execFileSync('git', args, {
    cwd: vaultDir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'e2e', GIT_AUTHOR_EMAIL: 'e2e@e2e', GIT_COMMITTER_NAME: 'e2e', GIT_COMMITTER_EMAIL: 'e2e@e2e',
      GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_CONFIG_NOSYSTEM: '1', HOME: vaultDir,
    },
  });
}

/** Two commits of the notes, one uncommitted edit, then every note stamped with the sync time. */
function makeSyncedGitVault(vaultDir: string): void {
  git(vaultDir, FIRST_COMMIT_MS, 'init', '-q', '-b', 'main');
  for (let i = 0; i < NOTE_COUNT; i++) writeNote(vaultDir, notePath(i), firstVersion(i));
  git(vaultDir, FIRST_COMMIT_MS, 'add', 'notes');
  git(vaultDir, FIRST_COMMIT_MS, 'commit', '-q', '-m', 'first');
  for (let i = 0; i < CHANGED_IN_SECOND_COMMIT; i++) writeNote(vaultDir, notePath(i), secondVersion(i));
  git(vaultDir, SECOND_COMMIT_MS, 'commit', '-q', '-am', 'second');
  writeNote(vaultDir, notePath(DIRTY_NOTE_INDEX), 'edited after the last commit\n');
  stampAllNotes(vaultDir, SYNC_TIME_MS);
}

function stampAllNotes(vaultDir: string, mtimeMs: number): void {
  for (let i = 0; i < NOTE_COUNT; i++) utimesSync(join(vaultDir, notePath(i)), new Date(mtimeMs), new Date(mtimeMs));
}

function writeUncommittedSyncedNotes(vaultDir: string): void {
  for (let i = 0; i < NOTE_COUNT; i++) writeNote(vaultDir, notePath(i), firstVersion(i));
  stampAllNotes(vaultDir, SYNC_TIME_MS);
}

function diskMtimes(vaultDir: string): number[] {
  return Array.from({ length: NOTE_COUNT }, (_, i) => statSync(join(vaultDir, notePath(i))).mtimeMs);
}

async function launchAndOpenHeatmap(prepareVault: LaunchOptions['prepareVault']): Promise<ObsidianHarness> {
  const h = await ObsidianHarness.launch({ idleTimeoutSeconds: HIGH_IDLE_SECONDS, minFocusSecondsToRecord: 0, prepareVault });
  await h.trustVaultAuthor(); // its modal would cover the heatmap
  await h.page.evaluate(() => {
    window.app.workspace.leftSplit.collapse();
    window.app.workspace.rightSplit.collapse();
  });
  await h.page.setViewportSize(VIEWPORT); // the headless window boots too small to lay out
  await h.runCommand(CMD_OPEN_VAULT_HEATMAP);
  await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
  await expect(h.page.locator(FILE_COUNT_STAT).first()).toHaveText(String(NOTE_COUNT + DEV_VAULT_FILE_COUNT));
  await expect(h.page.locator(BANNER)).toBeVisible();
  return h;
}

/** Obsidian's cached TFile.stat.mtime per note — what the heatmap reads. */
function cachedMtimes(page: Page): Promise<number[]> {
  return page.evaluate((paths) => paths.map((p) => {
    const file = window.app.vault.getFileByPath(p);
    if (!file) throw new Error(`not in vault: path=[${p}]`);
    return file.stat.mtime;
  }), Array.from({ length: NOTE_COUNT }, (_, i) => notePath(i)));
}

test.describe('heatmap restore modified times from git', () => {
  let h: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (h) await h.close();
    h = undefined;
  });

  test('should set each committed note\'s modified time to its last commit time WHEN restoring from the banner', async () => {
    // GIVEN a synced git vault (all notes stamped with the sync time) with the heatmap open
    h = await launchAndOpenHeatmap(makeSyncedGitVault);
    const contentBefore = readFileSync(join(h.vaultDir, notePath(0)));
    const expected = Array.from({ length: NOTE_COUNT }, (_, i) => expectedRestoredMtime(i));

    // WHEN the user restores from the banner and confirms
    await h.page.locator(RESTORE_BUTTON).click();
    await h.page.getByRole('button', { name: 'Restore', exact: true }).click();
    const vaultDir = h.vaultDir;
    await pollUntil(
      () => diskMtimes(vaultDir).every((ms, i) => ms === expected[i]),
      `restored mtimes on disk, last seen=[${diskMtimes(vaultDir).join(',')}]`,
      { timeoutMs: RESTORE_TIMEOUT_MS },
    );

    // THEN Obsidian's file cache carries the commit times too (what the heatmap reads) …
    expect(await cachedMtimes(h.page)).toEqual(expected);
    // … the content is byte-identical (CRLF kept) …
    expect(readFileSync(join(h.vaultDir, notePath(0))).equals(contentBefore)).toBe(true);
    // … and the re-read heatmap no longer reports clustered times.
    await expect(h.page.locator(BANNER)).toHaveCount(0);
  });

  test('should offer no restore button WHEN the vault is not a git repo', async () => {
    // GIVEN the same clustered notes, but no .git at the vault root
    h = await launchAndOpenHeatmap(writeUncommittedSyncedNotes);

    // THEN the banner shows without the button
    await expect(h.page.locator(RESTORE_BUTTON)).toHaveCount(0);
  });
});
